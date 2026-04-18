// ─────────────────────────────────────────────
// Python 엔진 어댑터 (Skulpt 기반)
// ─────────────────────────────────────────────

import {EngineAdapter} from "@/engine/EngineAdapter.js";
import Sk from 'skulpt';

export class PythonEngineAdapter extends EngineAdapter {
    /** @type {string} */
    languageId = 'python'

    /**
     * @param {string} sourceCode
     */
    constructor(sourceCode) {
        super(sourceCode)

        // npm으로 불러온 Sk를 바로 할당합니다.
        this._Sk = Sk

        /** @type {any[]} AST / 실행할 문장 목록 */
        this._statements = []

        /** @type {number} 현재 실행할 문장 인덱스 */
        this._stmtIndex = 0

        /** @type {string} 표준 출력 누적 */
        this._stdout = ''

        /** @type {Record<string, any>} 현재 전역 심볼 테이블 (Skulpt 내부) */
        this._globals = {}
    }

    /**
     * Skulpt 초기화 (CDN 로드 삭제됨 -> 즉시 실행 가능)
     * @returns {Promise<void>}
     */
    async init() {
        await super.reset()
        this._stdout = ''

        // ── 1. Skulpt 기본 설정 ──────────────────────
        this._Sk.configure({
            output: (text) => {
                this._stdout += text
            },
            read: (file) => {
                if (this._Sk.builtinFiles?.files[file] === undefined) {
                    throw new Error(`파일을 찾을 수 없습니다: ${file}`)
                }
                return this._Sk.builtinFiles.files[file]
            },
            execLimit: 10000,   // 무한 루프 방지 (밀리초)
        })

        // ── 2. 소스 파싱 준비 ─────────────────────────────
        console.log('[PythonEngineAdapter] init() 완료 — Skulpt 내장 모듈 로드 성공')
    }

    /**
     * 한 줄(statement)을 실행하고 현재 상태를 반환합니다.
     *
     * @returns {Promise<import('./stateModel').ExecutionState>}
     */
    async next() {
        if (this._finished) {
            return this._history[this._history.length - 1]
        }

        try {
            // ── 현재는 목(Mock) 상태 반환 (개발용) ──────────
            const mockState = this._createMockState()
            return this._recordAndReturn(mockState)

        } catch (err) {
            const errorState = this._makeErrorState(
                err.toString(),
                this._stmtIndex + 1
            )
            return this._recordAndReturn(errorState)
        }
    }

    /**
     * Skulpt 심볼 테이블에서 변수를 추출하여 표준 포맷으로 변환
     * @param {Record<string, any>} globals - Skulpt globals 객체
     * @returns {import('./stateModel').Variable[]}
     * @private
     */
    _extractVariables(globals) {
        const variables = []

        for (const [name, skObj] of Object.entries(globals)) {
            // 언더스코어 시작 내부 변수는 제외
            if (name.startsWith('__')) continue
            variables.push(this._skObjectToVariable(name, skObj))
        }

        return variables
    }

    /**
     * Skulpt 객체를 표준 Variable 포맷으로 변환
     * @param {string} name
     * @param {any} skObj
     * @returns {import('./stateModel').Variable}
     * @private
     */
    _skObjectToVariable(name, skObj) {
        const jsValue = skObj?.v ?? skObj
        const typeName = skObj?.tp$name ?? typeof jsValue

        return {
            kind: 'primitive',
            name,
            type: typeName,
            value: jsValue,
        }
    }

    /**
     * 개발용 목 상태 생성 (실제 Skulpt 연동 전 UI 테스트용)
     * @returns {import('./stateModel').ExecutionState}
     * @private
     */
    _createMockState() {
        const step = this._step + 1
        return {
            step,
            currentLine: step,
            isFinished: step >= 5,
            language: 'python',
            callStack: [
                {
                    frameName: 'global',
                    frameId: 0,
                    variables: [
                        {kind: 'primitive', name: 'x', type: 'int', value: step * 10},
                        {kind: 'primitive', name: 'name', type: 'str', value: 'Alice'},
                        ...(step >= 2 ? [
                            {kind: 'pointer', name: 'ref', type: 'ref', pointsTo: 'x', value: null}
                        ] : []),
                        ...(step >= 3 ? [
                            {
                                kind: 'array', name: 'nums', type: 'list',
                                elements: [
                                    {index: 0, value: 1, type: 'int'},
                                    {index: 1, value: 2, type: 'int'},
                                    {index: 2, value: 3, type: 'int'},
                                ],
                            }
                        ] : []),
                    ],
                },
            ],
            heap: [],
            stdout: step >= 4 ? `Hello, Alice!\n` : '',
            error: null,
        }
    }
}