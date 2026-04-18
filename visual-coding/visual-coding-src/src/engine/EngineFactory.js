import {PythonEngineAdapter} from './PythonEngineAdapter.js'

/**
 * 언어 ID에 따라 적절한 엔진 어댑터를 생성합니다.
 */
export function createEngine(language, sourceCode) {
    switch (language) {
        case 'python':
            return new PythonEngineAdapter(sourceCode)
        case 'c':
            throw new Error('C 엔진은 아직 구현되지 않았습니다.')
        case 'java':
            throw new Error('Java 엔진은 아직 구현되지 않았습니다.')
        default:
            throw new Error(`지원하지 않는 언어입니다: ${language}`)
    }
}