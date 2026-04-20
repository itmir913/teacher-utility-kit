// ─────────────────────────────────────────────────────────────────
// PythonEngineAdapter — Skulpt 실제 연동 (라인별 step 실행)
//
// 핵심 메커니즘:
//   Skulpt debug=true 모드에서 매 라인마다 Suspension을 반환한다.
//   suspension_handler 안에서 Promise를 만들어 실행을 멈추고,
//   next()가 호출되면 그 Promise를 resolve해 resume()을 진행시킨다.
//
//   흐름:
//   init()
//    └─ _startExecution() → asyncToPromise(importMainWithBody, debug=true)
//         └─ 라인마다 suspension_handler 호출
//              └─ Promise 생성 후 _stepController에 저장하고 대기
//
//   next()
//    └─ _stepController.resolve() → Skulpt가 다음 라인까지 실행
//         └─ 다시 suspension_handler → Promise 대기
//    └─ 그 시점의 Sk.globals로 변수 스냅샷 반환
// ─────────────────────────────────────────────────────────────────

import {EngineAdapter} from '@/engine/EngineAdapter.js'
import Sk from 'skulpt'

export class PythonEngineAdapter extends EngineAdapter {
    languageId = 'python'

    constructor(sourceCode) {
        super(sourceCode)
        this._Sk = Sk
        this._stdout = ''
        this._currentLine = null
        this._programDone = false
        this._programError = null

        // step 제어 핵심: 현재 "실행을 재개할 resolve 함수"를 저장
        // Skulpt가 suspension에서 대기 중일 때 이 resolve를 호출하면 다음 라인으로 진행
        this._stepController = null   // { resolve, reject, lineno }

        // next()가 다음 suspension을 기다리는 Promise의 resolve
        this._waitForSuspension = null
    }

    // ─────────────────────────────────────────────
    // init()
    // ─────────────────────────────────────────────
    async init() {
        await super.reset()
        this._stdout = ''
        this._currentLine = null
        this._programDone = false
        this._programError = null
        this._stepController = null
        this._waitForSuspension = null

        this._Sk.configure({
            output: (text) => {
                this._stdout += text
            },
            read: (file) => {
                if (this._Sk.builtinFiles?.files[file] === undefined) {
                    throw new Error(`File not found: ${file}`)
                }
                return this._Sk.builtinFiles.files[file]
            },
            execLimit: 30000,
            python3: true,
        })

        // 실행 시작 후 첫 번째 suspension까지 대기
        await this._startAndWaitFirstSuspension()
    }

    // ─────────────────────────────────────────────
    // _startAndWaitFirstSuspension()
    // 프로그램을 시작하고 첫 라인의 suspension까지 도달
    // ─────────────────────────────────────────────
    _startAndWaitFirstSuspension() {
        return new Promise((resolveInit) => {
            // suspension_handler: Skulpt가 각 라인에서 멈출 때 호출
            const suspensionHandler = (suspension) => {
                // Skulpt 버전에 따라 lineno 위치가 다를 수 있음 ($lineno 또는 lineno)
                const currentLine = suspension.$lineno ?? suspension.lineno;
                if (currentLine != null) {
                    this._currentLine = currentLine;
                }

                // next()가 이 suspension을 기다리고 있다면 알림
                if (this._waitForSuspension) {
                    const notify = this._waitForSuspension;
                    this._waitForSuspension = null;
                    notify();
                }

                // init()의 첫 suspension 대기를 해제
                if (resolveInit) {
                    const r = resolveInit;
                    resolveInit = null;  // 한 번만 실행
                    Promise.resolve().then(r);
                }

                // ★ 여기가 핵심 수정 포인트입니다 ★
                return new Promise((resolve, reject) => {
                    this._stepController = {
                        resolve: () => {
                            try {
                                // 단순 resolve()가 아니라, suspension.resume()의
                                // 결과(새로운 suspension 또는 실행 완료 값)를 넘겨주어야
                                // Skulpt의 내부 루프가 다음 라인으로 정상 진행됩니다.
                                resolve(suspension.resume());
                            } catch (e) {
                                reject(e);
                            }
                        },
                        reject
                    };
                });
            }

            // 'Debug' 타입이나 '*' (전체)를 가로챕니다.
            const susp_handlers = {'*': suspensionHandler};

            // debug=true (4번째 인자) 로 실행
            this._Sk.misceval.asyncToPromise(
                () => this._Sk.importMainWithBody('<stdin>', false, this.sourceCode, true),
                susp_handlers
            ).then(
                () => {
                    this._programDone = true;
                    this._finished = true;
                    if (resolveInit) {
                        resolveInit();
                        resolveInit = null;
                    }
                    if (this._waitForSuspension) {
                        const n = this._waitForSuspension;
                        this._waitForSuspension = null;
                        n();
                    }
                },
                (err) => {
                    this._programDone = true;
                    this._finished = true;
                    this._programError = err;
                    if (resolveInit) {
                        resolveInit();
                        resolveInit = null;
                    }
                    if (this._waitForSuspension) {
                        const n = this._waitForSuspension;
                        this._waitForSuspension = null;
                        n();
                    }
                }
            );
        });
    }

    // ─────────────────────────────────────────────
    // next(): 현재 라인 상태 반환 후 다음 라인으로 진행
    // ─────────────────────────────────────────────
    async next() {
        if (this._finished && this._history.length > 0) {
            return this._history[this._history.length - 1]
        }

        try {
            // 1. 현재 라인/변수 스냅샷 기록
            const lineNow = this._currentLine
            const variablesNow = this._captureGlobals()
            const stdoutNow = this._stdout

            // 2. 프로그램이 이미 완료됐다면 finished 상태 반환
            if (this._programDone) {
                const state = this._buildState(lineNow, variablesNow, stdoutNow, true)
                return this._recordAndReturn(state)
            }

            // 3. Skulpt를 다음 라인까지 재개
            if (this._stepController) {
                const ctrl = this._stepController
                this._stepController = null

                // 다음 suspension 또는 완료를 기다리는 Promise
                const nextEvent = new Promise((resolve) => {
                    this._waitForSuspension = resolve
                })

                // resume → Skulpt가 다음 라인까지 실행 후 멈춤
                ctrl.resolve()

                // 다음 suspension 대기
                await nextEvent
            }

            // 4. 이 시점의 상태를 이전 스냅샷으로 반환
            //    (라인 lineNow를 "실행한 결과"가 variablesNow)
            const isFinished = this._programDone && !this._stepController
            const state = this._buildState(lineNow, variablesNow, stdoutNow, isFinished)
            return this._recordAndReturn(state)

        } catch (err) {
            const errorState = this._makeErrorState(this._formatError(err), this._currentLine)
            return this._recordAndReturn(errorState)
        }
    }

    // ─────────────────────────────────────────────
    // _captureGlobals()
    // ─────────────────────────────────────────────
    _captureGlobals() {
        const globals = this._Sk.globals
        if (!globals) return []
        const variables = []
        for (const [name, skObj] of Object.entries(globals)) {
            if (name.startsWith('__') || name.startsWith('$')) continue
            try {
                const v = this._skObjToVariable(name, skObj)
                if (v) variables.push(v)
            } catch (_) { /* 변환 실패 무시 */
            }
        }
        return variables
    }

    // ─────────────────────────────────────────────
    // _skObjToVariable()
    // ─────────────────────────────────────────────
    _skObjToVariable(name, skObj) {
        if (!skObj) return null
        const tp = skObj.tp$name ?? 'unknown'

        // 함수/클래스/모듈 제외
        if (['function', 'type', 'module', 'classobj', 'builtin_function_or_method',
            'method', 'wrapper_descriptor', 'method-wrapper'].includes(tp)) return null

        if (tp === 'int' || tp === 'float') {
            return {kind: 'primitive', name, type: tp, value: skObj.v}
        }
        if (tp === 'bool') {
            return {kind: 'primitive', name, type: 'bool', value: !!skObj.v}
        }
        if (tp === 'str') {
            return {kind: 'primitive', name, type: 'str', value: skObj.v}
        }
        if (tp === 'NoneType') {
            return {kind: 'primitive', name, type: 'None', value: null}
        }
        if (tp === 'list' || tp === 'tuple') {
            const elements = (skObj.v ?? []).map((el, i) => ({
                index: i,
                value: this._skToJs(el),
                type: el?.tp$name ?? 'unknown',
            }))
            return {kind: 'array', name, type: tp, elements}
        }
        if (tp === 'dict') {
            return {kind: 'object', name, type: 'dict', properties: this._dictProps(skObj)}
        }
        // 기타: 문자열로 변환
        const jsVal = this._skToJs(skObj)
        if (jsVal !== undefined) {
            return {kind: 'primitive', name, type: tp, value: String(jsVal)}
        }
        return null
    }

    _skToJs(skObj) {
        if (!skObj) return null
        if (skObj.v !== undefined) return skObj.v
        return undefined
    }

    _dictProps(skObj) {
        const props = []
        // Skulpt dict는 버전에 따라 내부 구조가 다름
        // v1: skObj.entries (Map-like)
        // v2: skObj.v (object)
        try {
            if (typeof skObj.tp$iter === 'function') {
                // 이터레이터 방식으로 접근
                const iter = skObj.tp$iter()
                let next
                while ((next = iter.tp$iternext()) !== undefined) {
                    const key = this._skToJs(next)
                    const val = skObj.mp$subscript(next)
                    props.push({
                        key: key ?? String(next),
                        value: this._skToJs(val),
                        type: val?.tp$name ?? 'unknown',
                        kind: 'primitive',
                    })
                }
            } else if (skObj.v) {
                for (const [k, v] of Object.entries(skObj.v)) {
                    props.push({key: k, value: this._skToJs(v), type: v?.tp$name ?? 'unknown', kind: 'primitive'})
                }
            }
        } catch (_) { /* dict 접근 실패 시 빈 배열 */
        }
        return props
    }

    // ─────────────────────────────────────────────
    // _buildState()
    // ─────────────────────────────────────────────
    _buildState(line, variables, stdout, isFinished = false) {
        return {
            step: this._step + 1,
            currentLine: line,
            isFinished,
            language: 'python',
            callStack: [{
                frameName: 'global',
                frameId: 0,
                variables: variables.filter(Boolean),
            }],
            heap: [],
            stdout,
            error: this._programError
                ? {message: this._formatError(this._programError), line}
                : null,
        }
    }

    _formatError(err) {
        if (!err) return ''
        try {
            if (err.args?.v?.length) {
                const tp = err.tp$name ?? 'Error'
                const msg = err.args.v.map(a => a.v ?? String(a)).join(', ')
                return `${tp}: ${msg}`
            }
        } catch (_) {
        }
        return String(err)
    }
}