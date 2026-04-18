# 메모리 시각화 도구 — 아키텍처 문서

## 디렉토리 구조

```
teacher-utility-kit/
├── visual-coding/          ← 빌드 출력 (GitHub Pages에서 서빙)
│   ├── index.html
│   └── assets/
│
└── visual-coding-src/      ← 개발 소스 (여기서 작업)
    ├── index.html
    ├── package.json
    ├── vite.config.js      ← outDir: '../visual-coding', emptyOutDir: false
    └── src/
        ├── main.js
        ├── style.css       ← Tailwind v4 진입점
        ├── App.vue         ← 메인 컴포넌트 (좌우 분할 레이아웃)
        │
        └── engine/         ← 언어 엔진 어댑터 레이어
            ├── EngineAdapter.js   ← 추상 기반 클래스 + PythonEngineAdapter
            └── stateModel.js     ← ExecutionState 표준 JSON 포맷 정의
```

## 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────┐
│                      App.vue (프론트엔드)                 │
│                                                         │
│  [에디터 패널]          [시각화 패널]                       │
│  - textarea            - 스택 프레임 박스                  │
│  - 이전/다음 버튼       - 힙 영역                          │
│  - stdout 출력         - SVG 포인터 화살표                 │
│                                                         │
│  handleNext() ──────────────────────────────┐           │
│  handlePrev() ◄─ engine.prev() (히스토리)    │           │
└────────────────────────────────────────┬────┘           
                                         │ await engine.next()
                                         ▼
┌─────────────────────────────────────────────────────────┐
│              EngineAdapter (공통 인터페이스)               │
│                                                         │
│  + init()                       추상 메서드              │
│  + next() → ExecutionState      추상 메서드              │
│  + prev() → ExecutionState      히스토리 기반 (기반 클래스)│
│  + reset()                                              │
│  # _recordAndReturn(state)      히스토리 누적             │
│  # _makeErrorState(msg, line)   에러 상태 생성            │
└────────────────────┬────────────────────────────────────┘
                     │ extends
        ┌────────────┼─────────────┐
        ▼            ▼             ▼
┌──────────────┐ ┌─────────┐ ┌──────────┐
│Python Adapter│ │C Adapter│ │JavaAdapt.│
│  (Skulkt)    │ │(JSCPP)  │ │(TODO)    │
└──────────────┘ └─────────┘ └──────────┘
        │
        ▼ 변환
┌─────────────────────────────────────────────────────────┐
│                   ExecutionState (표준 JSON)              │
│                                                         │
│  step, currentLine, isFinished, language                │
│  callStack: [ { frameName, frameId, variables[] } ]     │
│  variables: primitive | array | object | pointer        │
│  pointer.pointsTo: "varName" | ["varA", "varB"]        │
│  heap: [ { id, type, value } ]                          │
│  stdout, error                                          │
└─────────────────────────────────────────────────────────┘
```

## 핵심 설계 원칙

### 1. Iterator 패턴

```js
const engine = createEngine('python', sourceCode)
await engine.init()

// 앞으로
const state = await engine.next()   // → ExecutionState

// 뒤로 (히스토리 기반, 런타임 역실행 X)
const prevState = engine.prev()
```

### 2. 포인터 시각화

`pointsTo` 속성이 있는 변수는 SVG 베지어 곡선 화살표로 대상 박스를 가리킵니다.

- 단일: `pointsTo: "x"`
- 다중: `pointsTo: ["node1", "node2"]` (연결 리스트 등)

### 3. emptyOutDir: false 필수

`visual-coding/` 폴더에 다른 정적 파일이 공존하므로 빌드 시 기존 파일을 절대 삭제하지 않습니다.

## 다음 구현 단계

1. **Skulkt 실제 연동**: `PythonEngineAdapter._createMockState()` → 실제 Skulkt API
2. **C 엔진**: `CEngineAdapter` (JSCPP 라이브러리 사용)
3. **코드 에디터**: CodeMirror 6 통합으로 문법 하이라이팅 추가
4. **단계 슬라이더**: 히스토리 기반 타임라인 UI
5. **내보내기**: 실행 결과를 이미지/GIF로 저장

## 시작 방법

```bash
cd teacher-utility-kit/visual-coding-src
npm install
npm run dev       # 개발 서버 (localhost:5173)
npm run build     # ../visual-coding/ 으로 빌드 출력
```
