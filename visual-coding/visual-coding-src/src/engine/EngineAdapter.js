// 파일 위치: src/engine/EngineAdapter.js

export class EngineAdapter {
    constructor(sourceCode) {
        if (new.target === EngineAdapter) {
            throw new Error('EngineAdapter는 추상 클래스입니다. 직접 인스턴스화할 수 없습니다.')
        }
        this.sourceCode = sourceCode
        this._step = 0
        this._finished = false
        this._history = []
    }

    async init() { throw new Error('init()을 구현해야 합니다.') }
    async next() { throw new Error('next()를 구현해야 합니다.') }
    async reset() {
        this._step = 0
        this._finished = false
        this._history = []
    }

    isFinished() { return this._finished }
    currentStep() { return this._step }

    prev() {
        if (this._history.length <= 1) return this._history[0] ?? null
        this._history.pop()
        this._step = Math.max(0, this._step - 1)
        this._finished = false
        return this._history[this._history.length - 1]
    }

    _recordAndReturn(state) {
        this._history.push(state)
        this._step = state.step
        this._finished = state.isFinished
        return state
    }

    _makeErrorState(message, line = null) {
        return {
            step: this._step,
            currentLine: line,
            isFinished: true,
            language: this.languageId ?? 'unknown',
            callStack: [],
            heap: [],
            stdout: '',
            error: {message, line},
        }
    }
}