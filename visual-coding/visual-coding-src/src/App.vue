<script setup>
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import {createEngine} from './engine/EngineFactory.js'

// ─────────────────────────────────────────────
// 상태 정의
// ─────────────────────────────────────────────

/** 사용자가 입력한 소스 코드 */
const sourceCode = ref(`x = 10
name = "Alice"
ref = x
nums = [1, 2, 3]
print(f"Hello, {name}!")`)

/** 선택된 언어 */
const language = ref('python')

/** 현재 실행 상태 (ExecutionState) */
const currentState = ref(null)

/** 현재 활성화된 엔진 어댑터 인스턴스 */
const engine = ref(null)

/** 로딩 상태 */
const isLoading = ref(false)

/** 초기화 여부 */
const isInitialized = ref(false)

/** 오류 메시지 */
const errorMessage = ref(null)

/** 콘솔 출력 내용 */
const consoleOutput = computed(() => currentState.value?.stdout ?? '')

/** 현재 실행 단계 */
const currentStep = computed(() => currentState.value?.step ?? 0)

/** 현재 하이라이트할 라인 */
const currentLine = computed(() => currentState.value?.currentLine ?? null)

/** 실행 완료 여부 */
const isFinished = computed(() => currentState.value?.isFinished ?? false)

/** 이전 단계 가능 여부 */
const canGoPrev = computed(() => currentStep.value > 0)

/** 다음 단계 가능 여부 */
const canGoNext = computed(() => isInitialized.value && !isFinished.value)

// ─────────────────────────────────────────────
// SVG 화살표 (포인터 시각화)
// ─────────────────────────────────────────────

/** 변수 박스 DOM 참조 맵 { variableName: HTMLElement } */
const varBoxRefs = ref({})

/** 화살표 경로 목록 */
const arrowPaths = ref([])

/** 시각화 영역 컨테이너 */
const vizContainer = ref(null)

/** 현재 프레임의 모든 변수 (평탄화) */
const allVariables = computed(() => {
  if (!currentState.value) return []
  return currentState.value.callStack.flatMap(frame => frame.variables)
})

/** 포인터 변수 목록 */
const pointerVariables = computed(() =>
    allVariables.value.filter(v => v.kind === 'pointer')
)

/**
 * 변수 박스 ref 등록 콜백
 * v-for에서 :ref="(el) => registerVarBox(el, variable.name)" 형태로 사용
 */
function registerVarBox(el, name) {
  if (el) varBoxRefs.value[name] = el
  else delete varBoxRefs.value[name]
}

/**
 * 포인터 → 대상 변수 간 SVG 화살표 경로를 계산합니다.
 * 컨테이너 기준 상대 좌표를 사용합니다.
 */
async function recalcArrows() {
  await nextTick()
  if (!vizContainer.value) return

  const containerRect = vizContainer.value.getBoundingClientRect()
  const paths = []

  for (const pointer of pointerVariables.value) {
    const targets = Array.isArray(pointer.pointsTo)
        ? pointer.pointsTo
        : [pointer.pointsTo]

    for (const targetName of targets) {
      const fromEl = varBoxRefs.value[pointer.name]
      const toEl = varBoxRefs.value[targetName]

      if (!fromEl || !toEl) continue

      const fromRect = fromEl.getBoundingClientRect()
      const toRect = toEl.getBoundingClientRect()

      // 출발: 박스 오른쪽 중앙
      const x1 = fromRect.right - containerRect.left
      const y1 = fromRect.top + fromRect.height / 2 - containerRect.top

      // 도착: 박스 왼쪽 중앙
      const x2 = toRect.left - containerRect.left
      const y2 = toRect.top + toRect.height / 2 - containerRect.top

      // 베지어 곡선 제어점
      const cx1 = x1 + (x2 - x1) * 0.5
      const cx2 = x2 - (x2 - x1) * 0.5

      paths.push({
        id: `${pointer.name}->${targetName}`,
        d: `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`,
        label: pointer.name,
      })
    }
  }

  arrowPaths.value = paths
}

// 상태 변화 시 화살표 재계산
watch(currentState, () => recalcArrows(), {flush: 'post'})

// ─────────────────────────────────────────────
// 엔진 제어 메서드
// ─────────────────────────────────────────────

/** 엔진을 초기화하고 첫 번째 상태를 로드합니다. */
async function initEngine() {
  isLoading.value = true
  errorMessage.value = null
  currentState.value = null
  varBoxRefs.value = {}
  arrowPaths.value = []

  try {
    engine.value = createEngine(language.value, sourceCode.value)
    await engine.value.init()
    isInitialized.value = true
  } catch (err) {
    errorMessage.value = `초기화 실패: ${err.message}`
    isInitialized.value = false
  } finally {
    isLoading.value = false
  }
}

/** 다음 단계 실행 */
async function handleNext() {
  if (!canGoNext.value || isLoading.value) return
  isLoading.value = true

  try {
    const state = await engine.value.next()
    currentState.value = state

    if (state.error) {
      errorMessage.value = `실행 오류 (${state.error.line}번째 줄): ${state.error.message}`
    } else {
      errorMessage.value = null
    }
  } catch (err) {
    errorMessage.value = err.message
  } finally {
    isLoading.value = false
  }
}

/** 이전 단계로 되돌리기 */
function handlePrev() {
  if (!canGoPrev.value || isLoading.value) return

  const state = engine.value.prev()
  if (state) {
    currentState.value = state
    errorMessage.value = null
  }
}

/** 처음부터 다시 시작 */
async function handleReset() {
  isInitialized.value = false
  currentState.value = null
  arrowPaths.value = []
  varBoxRefs.value = {}
  await initEngine()
}

// ─────────────────────────────────────────────
// 코드 에디터: 줄번호 하이라이트 계산
// ─────────────────────────────────────────────

const codeLines = computed(() =>
    sourceCode.value.split('\n').map((text, i) => ({
      number: i + 1,
      text,
      isActive: currentLine.value === i + 1,
    }))
)

// ─────────────────────────────────────────────
// 윈도우 리사이즈 시 화살표 재계산
// ─────────────────────────────────────────────

onMounted(() => window.addEventListener('resize', recalcArrows))
onUnmounted(() => window.removeEventListener('resize', recalcArrows))

// ─────────────────────────────────────────────
// 변수 타입별 스타일 헬퍼
// ─────────────────────────────────────────────

const kindStyles = {
  primitive: 'border-sky-400 bg-sky-950/40',
  array: 'border-amber-400 bg-amber-950/40',
  object: 'border-violet-400 bg-violet-950/40',
  pointer: 'border-rose-400 bg-rose-950/40',
}

function getKindStyle(kind) {
  return kindStyles[kind] ?? 'border-slate-400 bg-slate-800/40'
}

const kindLabel = {
  primitive: '원시',
  array: '배열',
  object: '객체',
  pointer: '포인터',
}
</script>

<template>
  <div class="app-shell">

    <!-- ══ 헤더 ══════════════════════════════════════════════════ -->
    <header class="app-header">
      <div class="header-brand">
        <span class="header-icon">⟨/⟩</span>
        <h1 class="header-title">메모리 시각화</h1>
        <span class="header-subtitle">Python Tutor 모던 버전</span>
      </div>

      <div class="header-controls">
        <!-- 언어 선택 -->
        <select v-model="language" class="lang-select">
          <option value="python">Python</option>
          <option value="c" disabled>C (준비 중)</option>
          <option value="java" disabled>Java (준비 중)</option>
        </select>

        <!-- 실행 버튼 -->
        <button @click="initEngine" :disabled="isLoading" class="btn btn-primary">
          <span v-if="isLoading" class="spinner"/>
          {{ isInitialized ? '재시작' : '실행 준비' }}
        </button>
      </div>
    </header>

    <!-- ══ 메인 영역 (좌/우 분할) ════════════════════════════════ -->
    <main class="app-main">

      <!-- ── 좌측: 코드 에디터 ──────────────────────────────── -->
      <section class="editor-panel">
        <div class="panel-label">코드 에디터</div>

        <!-- 코드 입력 영역 (줄번호 + textarea 오버레이) -->
        <div class="code-editor-wrap">
          <!-- 줄번호 + 하이라이트 레이어 -->
          <div class="line-numbers" aria-hidden="true">
            <div
                v-for="line in codeLines"
                :key="line.number"
                class="line-number-row"
                :class="{ 'line-active': line.isActive }"
            >
              <span class="line-num">{{ line.number }}</span>
              <span class="line-highlight-bar"/>
            </div>
          </div>

          <!-- 실제 편집 가능한 textarea -->
          <textarea
              v-model="sourceCode"
              class="code-textarea"
              spellcheck="false"
              autocomplete="off"
              placeholder="여기에 코드를 입력하세요..."
              @input="() => { isInitialized = false; currentState = null }"
          />
        </div>

        <!-- 단계 컨트롤 버튼 -->
        <div class="step-controls">
          <button
              @click="handlePrev"
              :disabled="!canGoPrev || isLoading"
              class="btn btn-secondary"
          >
            ◀ 이전 단계
          </button>

          <div class="step-badge">
            <template v-if="currentState">
              Step {{ currentStep }}
              <span v-if="isFinished" class="finished-chip">완료</span>
            </template>
            <template v-else>대기 중</template>
          </div>

          <button
              @click="handleNext"
              :disabled="!canGoNext || isLoading"
              class="btn btn-accent"
          >
            <span v-if="isLoading" class="spinner"/>
            다음 단계 ▶
          </button>
        </div>

        <!-- 오류 메시지 -->
        <div v-if="errorMessage" class="error-box">
          <span class="error-icon">⚠</span> {{ errorMessage }}
        </div>

        <!-- 표준 출력 -->
        <div class="stdout-panel">
          <div class="panel-label">출력 (stdout)</div>
          <pre class="stdout-content">{{ consoleOutput || '(아직 출력 없음)' }}</pre>
        </div>
      </section>

      <!-- ── 우측: 메모리 시각화 영역 ──────────────────────────── -->
      <section class="viz-panel">
        <div class="panel-label">메모리 시각화</div>

        <!-- 초기화 전 안내 -->
        <div v-if="!isInitialized && !currentState" class="viz-empty">
          <div class="empty-icon">🧠</div>
          <p>「실행 준비」 버튼을 누른 후<br>「다음 단계」로 진행하세요.</p>
        </div>

        <!-- 시각화 컨테이너 (SVG 오버레이 + 변수 박스) -->
        <div v-else ref="vizContainer" class="viz-container">

          <!-- SVG 화살표 레이어 (포인터 시각화) -->
          <svg class="arrow-svg" aria-hidden="true">
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6"
                      refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" class="arrow-marker"/>
              </marker>
            </defs>
            <g v-for="arrow in arrowPaths" :key="arrow.id">
              <path
                  :d="arrow.d"
                  class="arrow-path"
                  marker-end="url(#arrowhead)"
              />
            </g>
          </svg>

          <!-- 콜 스택 프레임들 -->
          <div
              v-for="frame in currentState?.callStack ?? []"
              :key="frame.frameId"
              class="stack-frame"
          >
            <div class="frame-title">
              <span class="frame-icon">⬡</span>
              {{ frame.frameName }} 프레임
            </div>

            <!-- 변수 박스 그리드 -->
            <div class="variables-grid">
              <div
                  v-for="variable in frame.variables"
                  :key="variable.name"
                  :ref="(el) => registerVarBox(el, variable.name)"
                  class="var-box"
                  :class="getKindStyle(variable.kind)"
              >
                <!-- 변수 헤더 -->
                <div class="var-header">
                  <span class="var-name">{{ variable.name }}</span>
                  <span class="var-type">{{ variable.type }}</span>
                  <span class="var-kind-chip">{{ kindLabel[variable.kind] }}</span>
                </div>

                <!-- 기본형 -->
                <div v-if="variable.kind === 'primitive'" class="var-value">
                  {{ variable.value }}
                </div>

                <!-- 배열 -->
                <div v-else-if="variable.kind === 'array'" class="array-cells">
                  <div
                      v-for="el in variable.elements"
                      :key="el.index"
                      class="array-cell"
                  >
                    <span class="array-index">[{{ el.index }}]</span>
                    <span class="array-value">{{ el.value }}</span>
                  </div>
                </div>

                <!-- 객체 -->
                <div v-else-if="variable.kind === 'object'" class="object-props">
                  <div
                      v-for="prop in variable.properties"
                      :key="prop.key"
                      class="object-prop"
                  >
                    <span class="prop-key">{{ prop.key }}:</span>
                    <span class="prop-value">{{ prop.value }}</span>
                  </div>
                </div>

                <!-- 포인터 -->
                <div v-else-if="variable.kind === 'pointer'" class="var-value pointer-value">
                  <span class="pointer-arrow">→</span>
                  <span class="pointer-target">{{ variable.pointsTo }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 힙 영역 -->
          <div v-if="currentState?.heap?.length" class="heap-section">
            <div class="frame-title">
              <span class="frame-icon">◈</span>
              힙 (Heap)
            </div>
            <div class="variables-grid">
              <div
                  v-for="obj in currentState.heap"
                  :key="obj.id"
                  :ref="(el) => registerVarBox(el, obj.id)"
                  class="var-box border-teal-400 bg-teal-950/40"
              >
                <div class="var-header">
                  <span class="var-name">{{ obj.id }}</span>
                  <span class="var-type">{{ obj.type }}</span>
                </div>
                <div class="var-value">{{ obj.value }}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style>
/* ─── Google Fonts: Fira Code + Pretendard ─────────────────── */
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&display=swap');

/* ─── CSS 변수 (디자인 토큰) ──────────────────────────────── */
:root {
  --bg-base: #0b0f1a;
  --bg-surface: #111827;
  --bg-raised: #1a2235;
  --border: #1e2d45;
  --text-primary: #e2e8f0;
  --text-secondary: #64748b;
  --text-muted: #334155;
  --accent-blue: #38bdf8;
  --accent-green: #34d399;
  --accent-rose: #fb7185;
  --accent-amber: #fbbf24;
  --font-mono: 'Fira Code', 'Cascadia Code', monospace;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: 'Pretendard', 'Noto Sans KR', system-ui, sans-serif;
  height: 100dvh;
  overflow: hidden;
}

/* ─── 앱 레이아웃 ─────────────────────────────────────────── */
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100dvh;
}

/* ─── 헤더 ───────────────────────────────────────────────── */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  height: 3.5rem;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-icon {
  font-size: 1.25rem;
  color: var(--accent-blue);
  font-family: var(--font-mono);
}

.header-title {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.header-subtitle {
  font-size: 0.7rem;
  color: var(--text-secondary);
  background: var(--bg-raised);
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--border);
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* ─── 메인 분할 레이아웃 ───────────────────────────────────── */
.app-main {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  flex: 1;
  overflow: hidden;
}

/* ─── 패널 공통 ───────────────────────────────────────────── */
.editor-panel,
.viz-panel {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  gap: 0.75rem;
  overflow: hidden;
}

.editor-panel {
  border-right: 1px solid var(--border);
}

.panel-label {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-secondary);
}

/* ─── 코드 에디터 ─────────────────────────────────────────── */
.code-editor-wrap {
  position: relative;
  flex: 1;
  display: flex;
  background: #060d1a;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  overflow: hidden;
  min-height: 0;
}

.line-numbers {
  flex-shrink: 0;
  width: 3rem;
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  overflow: hidden;
  user-select: none;
  pointer-events: none;
}

.line-number-row {
  display: flex;
  align-items: center;
  height: 1.5rem; /* line-height와 동일하게 */
  position: relative;
  transition: background 0.2s;
}

.line-number-row.line-active {
  background: rgba(56, 189, 248, 0.12);
}

.line-number-row.line-active .line-num {
  color: var(--accent-blue);
}

.line-num {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-muted);
  text-align: right;
  width: 100%;
  padding-right: 0.5rem;
  line-height: 1.5rem;
}

.code-textarea {
  flex: 1;
  background: transparent;
  color: #93c5fd;
  font-family: var(--font-mono);
  font-size: 0.82rem;
  line-height: 1.5rem;
  padding: 0 0.75rem;
  border: none;
  outline: none;
  resize: none;
  white-space: pre;
  overflow: auto;
  caret-color: var(--accent-blue);
}

/* ─── 단계 컨트롤 ─────────────────────────────────────────── */
.step-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.step-badge {
  flex: 1;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.finished-chip {
  background: rgba(52, 211, 153, 0.15);
  color: var(--accent-green);
  font-size: 0.65rem;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  border: 1px solid rgba(52, 211, 153, 0.3);
}

/* ─── 에러 박스 ───────────────────────────────────────────── */
.error-box {
  background: rgba(251, 113, 133, 0.1);
  border: 1px solid rgba(251, 113, 133, 0.3);
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.78rem;
  color: var(--accent-rose);
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.error-icon {
  flex-shrink: 0;
}

/* ─── stdout ─────────────────────────────────────────────── */
.stdout-panel {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex-shrink: 0;
}

.stdout-content {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--accent-green);
  background: #060d1a;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  min-height: 3rem;
  max-height: 5rem;
  overflow-y: auto;
  white-space: pre-wrap;
}

/* ─── 버튼 ───────────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.9rem;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent-blue);
  color: #0b0f1a;
  border-color: var(--accent-blue);
}

.btn-primary:hover:not(:disabled) {
  background: #7dd3fc;
}

.btn-secondary {
  background: var(--bg-raised);
  color: var(--text-primary);
  border-color: var(--border);
}

.btn-secondary:hover:not(:disabled) {
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}

.btn-accent {
  background: rgba(56, 189, 248, 0.1);
  color: var(--accent-blue);
  border-color: rgba(56, 189, 248, 0.35);
}

.btn-accent:hover:not(:disabled) {
  background: rgba(56, 189, 248, 0.2);
}

/* ─── 언어 선택 ───────────────────────────────────────────── */
.lang-select {
  background: var(--bg-raised);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  padding: 0.35rem 0.65rem;
  font-size: 0.8rem;
  cursor: pointer;
  outline: none;
}

.lang-select:focus {
  border-color: var(--accent-blue);
}

/* ─── 스피너 ─────────────────────────────────────────────── */
.spinner {
  display: inline-block;
  width: 0.85rem;
  height: 0.85rem;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ─── 시각화 패널 ─────────────────────────────────────────── */
.viz-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
  text-align: center;
  line-height: 1.7;
}

.empty-icon {
  font-size: 3rem;
  opacity: 0.5;
}

.viz-container {
  position: relative;
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ─── SVG 화살표 ─────────────────────────────────────────── */
.arrow-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
  z-index: 10;
}

.arrow-path {
  fill: none;
  stroke: var(--accent-rose);
  stroke-width: 1.5;
  stroke-dasharray: 4 2;
  animation: dashMove 1.5s linear infinite;
}

@keyframes dashMove {
  to {
    stroke-dashoffset: -18;
  }
}

.arrow-marker {
  fill: var(--accent-rose);
}

/* ─── 스택 프레임 ─────────────────────────────────────────── */
.stack-frame {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.heap-section {
  background: rgba(20, 184, 166, 0.05);
  border: 1px solid rgba(20, 184, 166, 0.2);
  border-radius: 0.5rem;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.frame-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
}

.frame-icon {
  color: var(--accent-blue);
}

/* ─── 변수 그리드 ─────────────────────────────────────────── */
.variables-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

/* ─── 변수 박스 ───────────────────────────────────────────── */
.var-box {
  border: 1px solid;
  border-radius: 0.4rem;
  padding: 0.5rem 0.65rem;
  min-width: 9rem;
  max-width: 16rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  position: relative;
  transition: transform 0.15s, box-shadow 0.15s;
  backdrop-filter: blur(4px);
}

.var-box:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.var-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.var-name {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary);
}

.var-type {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--text-secondary);
}

.var-kind-chip {
  margin-left: auto;
  font-size: 0.58rem;
  padding: 0.1rem 0.35rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.var-value {
  font-family: var(--font-mono);
  font-size: 0.88rem;
  color: var(--accent-green);
  word-break: break-all;
}

/* ─── 배열 셀 ─────────────────────────────────────────────── */
.array-cells {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.array-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.25);
  border-radius: 0.25rem;
  padding: 0.2rem 0.4rem;
  min-width: 2rem;
}

.array-index {
  font-size: 0.58rem;
  color: var(--accent-amber);
  font-family: var(--font-mono);
}

.array-value {
  font-size: 0.8rem;
  font-family: var(--font-mono);
  color: var(--text-primary);
}

/* ─── 객체 프로퍼티 ────────────────────────────────────────── */
.object-props {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.object-prop {
  display: flex;
  gap: 0.4rem;
  font-family: var(--font-mono);
  font-size: 0.78rem;
}

.prop-key {
  color: #c084fc;
  flex-shrink: 0;
}

.prop-value {
  color: var(--accent-green);
}

/* ─── 포인터 ─────────────────────────────────────────────── */
.pointer-value {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--accent-rose);
}

.pointer-arrow {
  font-size: 1rem;
}

.pointer-target {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  text-decoration: underline dotted;
}
</style>
