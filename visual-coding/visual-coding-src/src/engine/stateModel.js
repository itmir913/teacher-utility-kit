/**
 * ============================================================
 * 표준 실행 상태 JSON 모델 (Standard Execution State Model)
 * ============================================================
 *
 * 모든 언어 엔진 어댑터(Python, C, Java 등)는 next()를 호출할 때마다
 * 이 구조체를 반환해야 합니다.
 * 프론트엔드는 오직 이 포맷만 소비하며, 뒷단 언어 엔진에 독립적입니다.
 *
 * ▶ 설계 원칙:
 *   - 물리적 메모리 주소 대신 '개념적 모델'을 사용합니다.
 *   - pointsTo 속성으로 변수 간 참조 관계를 표현합니다.
 *   - 콜 스택, 힙, 프레임 분리를 통해 실제 메모리 구조를 교육합니다.
 */

// ─────────────────────────────────────────────
// 변수 값 타입 유니온
// ─────────────────────────────────────────────

/**
 * 기본형(Primitive) 변수
 * 예: int x = 5, str name = "Alice"
 */
export const PRIMITIVE_VARIABLE_EXAMPLE = {
    kind: 'primitive',       // 식별자: 'primitive' | 'object' | 'pointer' | 'array'
    name: 'x',              // 변수명
    type: 'int',            // 언어 수준의 타입 문자열 (예: 'int', 'str', 'float', 'bool')
    value: 42,              // 실제 값 (JS 원시값: number | string | boolean | null)
}

/**
 * 배열(Array) 변수
 * 예: int arr[] = {1, 2, 3}
 */
export const ARRAY_VARIABLE_EXAMPLE = {
    kind: 'array',
    name: 'arr',
    type: 'int[]',
    elements: [             // 배열 원소 목록 (인덱스 순서)
        {index: 0, value: 1, type: 'int'},
        {index: 1, value: 2, type: 'int'},
        {index: 2, value: 3, type: 'int'},
    ],
}

/**
 * 객체/구조체(Object) 변수
 * 예: Python dict, Java class instance, C struct
 */
export const OBJECT_VARIABLE_EXAMPLE = {
    kind: 'object',
    name: 'person',
    type: 'Person',         // 클래스/구조체명
    properties: [           // 내부 프로퍼티 목록 (재귀적으로 Variable 타입 사용 가능)
        {key: 'name', value: 'Alice', type: 'str', kind: 'primitive'},
        {key: 'age', value: 30, type: 'int', kind: 'primitive'},
    ],
}

/**
 * 포인터(Pointer) 변수
 * 예: C의 int *p = &x, Python의 객체 참조
 *
 * ▶ pointsTo: 가리키는 대상 변수의 name(들)
 *   단일 포인터: pointsTo: 'x'
 *   다중/체인:   pointsTo: ['node1', 'node2']  (연결 리스트 등)
 */
export const POINTER_VARIABLE_EXAMPLE = {
    kind: 'pointer',
    name: 'p',
    type: 'int*',
    pointsTo: 'x',          // string | string[] — 대상 변수의 name 참조
    value: null,            // 실제 포인팅 값은 pointsTo로 간접 표현 (표시용으로만 사용)
}

// ─────────────────────────────────────────────
// 스택 프레임 (Stack Frame)
// ─────────────────────────────────────────────

/**
 * 하나의 함수 호출에 대응하는 스택 프레임
 */
export const STACK_FRAME_EXAMPLE = {
    frameName: 'main',      // 함수명 (최상위는 'global' 또는 '__main__')
    frameId: 0,             // 유일한 프레임 식별자 (콜 스택 순서)
    variables: [            // 이 프레임에 속한 변수 목록
        PRIMITIVE_VARIABLE_EXAMPLE,
        POINTER_VARIABLE_EXAMPLE,
    ],
}

// ─────────────────────────────────────────────
// 최상위 실행 상태 (ExecutionState) — next()의 반환값
// ─────────────────────────────────────────────

/**
 * 언어 엔진의 next()가 반환하는 표준 실행 상태 객체
 *
 * @typedef {Object} ExecutionState
 */
export const EXECUTION_STATE_EXAMPLE = {
    // ── 메타 정보 ──────────────────────────────
    step: 3,                  // 현재까지 실행된 단계 번호 (0부터 시작)
    currentLine: 7,           // 에디터에서 하이라이트할 소스 코드 라인 번호 (1-based)
    isFinished: false,        // 프로그램 실행이 완료되었는지 여부
    language: 'python',       // 실행 중인 언어 식별자 ('python' | 'c' | 'java')

    // ── 콜 스택 ────────────────────────────────
    // 인덱스 0 = 가장 안쪽 프레임(현재 실행 중), 마지막 = global/main
    callStack: [
        {
            frameName: 'add',
            frameId: 1,
            variables: [
                {kind: 'primitive', name: 'a', type: 'int', value: 3},
                {kind: 'primitive', name: 'b', type: 'int', value: 4},
                {kind: 'primitive', name: 'result', type: 'int', value: 7},
            ],
        },
        {
            frameName: 'global',
            frameId: 0,
            variables: [
                {kind: 'primitive', name: 'x', type: 'int', value: 3},
                {kind: 'pointer', name: 'p', type: 'int*', pointsTo: 'x', value: null},
                {
                    kind: 'array', name: 'arr', type: 'int[]',
                    elements: [
                        {index: 0, value: 10, type: 'int'},
                        {index: 1, value: 20, type: 'int'},
                    ]
                },
                {
                    kind: 'object', name: 'person', type: 'Person',
                    properties: [
                        {key: 'name', value: 'Alice', type: 'str', kind: 'primitive'},
                        {key: 'age', value: 30, type: 'int', kind: 'primitive'},
                    ]
                },
            ],
        },
    ],

    // ── 힙 영역 (선택, C/Java 동적 할당 등) ──────
    heap: [
        {
            id: 'heap_0',         // 힙 객체 식별자 (포인터의 pointsTo에서 참조 가능)
            type: 'int',
            value: 99,
        },
    ],

    // ── 표준 출력 스트림 ────────────────────────
    stdout: 'Hello, World!\n',  // 지금까지 출력된 전체 stdout 누적값

    // ── 오류 정보 (정상 실행 시 null) ────────────
    error: null,
    // error 예시: { message: 'ZeroDivisionError: division by zero', line: 5 }
}


// ─────────────────────────────────────────────
// TypeScript-스타일 JSDoc 타입 정의 (IDE 지원용)
// ─────────────────────────────────────────────

/**
 * @typedef {'primitive'|'array'|'object'|'pointer'} VariableKind
 *
 * @typedef {Object} PrimitiveVariable
 * @property {'primitive'} kind
 * @property {string} name
 * @property {string} type
 * @property {number|string|boolean|null} value
 *
 * @typedef {Object} ArrayElement
 * @property {number} index
 * @property {number|string|boolean|null} value
 * @property {string} type
 *
 * @typedef {Object} ArrayVariable
 * @property {'array'} kind
 * @property {string} name
 * @property {string} type
 * @property {ArrayElement[]} elements
 *
 * @typedef {Object} ObjectProperty
 * @property {string} key
 * @property {number|string|boolean|null} value
 * @property {string} type
 * @property {VariableKind} kind
 *
 * @typedef {Object} ObjectVariable
 * @property {'object'} kind
 * @property {string} name
 * @property {string} type
 * @property {ObjectProperty[]} properties
 *
 * @typedef {Object} PointerVariable
 * @property {'pointer'} kind
 * @property {string} name
 * @property {string} type
 * @property {string|string[]} pointsTo  - 대상 변수의 name (단일 또는 배열)
 * @property {null} value
 *
 * @typedef {PrimitiveVariable|ArrayVariable|ObjectVariable|PointerVariable} Variable
 *
 * @typedef {Object} StackFrame
 * @property {string} frameName
 * @property {number} frameId
 * @property {Variable[]} variables
 *
 * @typedef {Object} HeapObject
 * @property {string} id
 * @property {string} type
 * @property {*} value
 *
 * @typedef {Object} ExecutionError
 * @property {string} message
 * @property {number|null} line
 *
 * @typedef {Object} ExecutionState
 * @property {number} step
 * @property {number} currentLine
 * @property {boolean} isFinished
 * @property {string} language
 * @property {StackFrame[]} callStack
 * @property {HeapObject[]} heap
 * @property {string} stdout
 * @property {ExecutionError|null} error
 */
