<script setup>
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import {createEngine} from './engine/EngineFactory.js'
import AppNav from './components/AppNav.vue'
import AppSidebar from './components/AppSidebar.vue'
import EditorPanel from './components/EditorPanel.vue'
import ConsolePanel from './components/ConsolePanel.vue'
import VariablesPanel from './components/VariablesPanel.vue'

// ── 상수
const CODE_EXAMPLES = [
  {label: '기본 변수', code: `x = 10\nname = "Alice"\ny = x + 5\nprint(f"Hello, {name}!")\nresult = x * y`},
  {label: '리스트 & 반복', code: `nums = [1, 2, 3, 4, 5]\ntotal = 0\nfor n in nums:\n    total = total + n\nprint(total)`},
  {label: '함수 호출', code: `def add(a, b):\n    result = a + b\n    return result\n\nx = 3\ny = 4\nsum = add(x, y)\nprint(sum)`},
  {label: '딕셔너리', code: `person = {"name": "Bob", "age": 25}\nperson["job"] = "dev"\nprint(person["name"])`},
]

const kindStyles = {
  primitive: {border: '#38bdf8', bg: 'rgba(56,189,248,0.07)'},
  array:     {border: '#fbbf24', bg: 'rgba(251,191,36,0.07)'},
  object:    {border: '#c084fc', bg: 'rgba(192,132,252,0.07)'},
  pointer:   {border: '#fb7185', bg: 'rgba(251,113,133,0.07)'},
}
const kindLabel = {primitive: 'val', array: '[]', object: '{}', pointer: '→'}

// ── 상태
const sourceCode = ref(CODE_EXAMPLES[0].code)
const language = ref('python')
const currentState = ref(null)
const engine = ref(null)
const isLoading = ref(false)
const isInitialized = ref(false)
const errorMessage = ref(null)
const isRunning = ref(false)
const runInterval = ref(null)
const executionSpeed = ref(600)
const sidebarOpen = ref(true)
const consoleOutput = ref('')
const consoleLog = ref([])

const currentStep = computed(() => currentState.value?.step ?? 0)
const currentLine = computed(() => currentState.value?.currentLine ?? null)
const isFinished = computed(() => currentState.value?.isFinished ?? false)
const canGoPrev = computed(() => currentStep.value > 0)
const canGoNext = computed(() => isInitialized.value && !isFinished.value && !isRunning.value)

const codeLines = computed(() =>
    sourceCode.value.split('\n').map((text, i) => ({
      number: i + 1, text, isActive: currentLine.value === i + 1,
    }))
)

// ── 리사이저
const panelContainer = ref(null)
const editorWidth = ref(35)
const consoleWidth = ref(30)
let activeResizer = null, startX = 0, startEditorW = 0, startConsoleW = 0

function onResizerMouseDown(e, which) {
  activeResizer = which
  startX = e.clientX
  startEditorW = editorWidth.value
  startConsoleW = consoleWidth.value
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  e.preventDefault()
}

function onMouseMove(e) {
  if (!panelContainer.value || !activeResizer) return
  const dx = ((e.clientX - startX) / panelContainer.value.offsetWidth) * 100
  if (activeResizer === 'left') editorWidth.value = Math.max(15, Math.min(60, startEditorW + dx))
  else consoleWidth.value = Math.max(15, Math.min(55, startConsoleW + dx))
}

function onMouseUp() {
  activeResizer = null
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

// ── 엔진 제어
function addLog(type, text) {
  consoleLog.value.push({type, text, id: Date.now() + Math.random()})
  nextTick(() => {
    const el = document.querySelector('.console-body')
    if (el) el.scrollTop = el.scrollHeight
  })
}

async function initEngine() {
  stopRun()
  isLoading.value = true
  errorMessage.value = null
  currentState.value = null
  consoleLog.value = []
  consoleOutput.value = ''
  try {
    engine.value = createEngine(language.value, sourceCode.value)
    await engine.value.init()
    isInitialized.value = true
    addLog('info', '▶ 엔진 초기화 완료. [다음 단계] 버튼을 눌러 실행하세요.')
  } catch (err) {
    errorMessage.value = `초기화 실패: ${err.message}`
    isInitialized.value = false
    addLog('error', `초기화 실패: ${err.message}`)
  } finally {
    isLoading.value = false
  }
}

async function handleNext() {
  if (!canGoNext.value || isLoading.value) return
  isLoading.value = true
  try {
    const state = await engine.value.next()
    const prevStdout = consoleOutput.value
    currentState.value = state
    if (state.stdout && state.stdout !== prevStdout) {
      const newLines = state.stdout.slice(prevStdout.length)
      if (newLines.trim()) addLog('log', newLines.trim())
    }
    consoleOutput.value = state.stdout ?? ''
    if (state.error) {
      errorMessage.value = `실행 오류 (${state.error.line}번째 줄): ${state.error.message}`
      addLog('error', errorMessage.value)
    } else {
      errorMessage.value = null
      addLog('info', `line ${state.currentLine} executed`)
    }
  } catch (err) {
    errorMessage.value = err.message
    addLog('error', err.message)
  } finally {
    isLoading.value = false
  }
}

function handlePrev() {
  if (!canGoPrev.value || isLoading.value) return
  const state = engine.value.prev()
  if (state) { currentState.value = state; errorMessage.value = null }
}

async function handleReset() {
  stopRun()
  isInitialized.value = false
  currentState.value = null
  consoleLog.value = []
  consoleOutput.value = ''
  await initEngine()
}

function startRun() {
  if (isRunning.value || !canGoNext.value) return
  isRunning.value = true
  addLog('info', '▶ 자동 실행 시작')
  runInterval.value = setInterval(async () => {
    if (!canGoNext.value || isFinished.value) { stopRun(); return }
    await handleNext()
  }, executionSpeed.value)
}

function stopRun() {
  if (runInterval.value) clearInterval(runInterval.value)
  runInterval.value = null
  if (isRunning.value) { isRunning.value = false; addLog('info', '⏸ 실행 일시정지') }
}

function handleToggleRun() { isRunning.value ? stopRun() : startRun() }

watch(executionSpeed, () => { if (isRunning.value) { stopRun(); startRun() } })

function loadExample(ex) {
  sourceCode.value = ex.code
  isInitialized.value = false
  currentState.value = null
  consoleLog.value = []
  consoleOutput.value = ''
}

function handleInvalidate() {
  isInitialized.value = false
  currentState.value = null
}

onUnmounted(() => {
  stopRun()
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
})
</script>

<template>
  <div id="app">
    <AppNav
        :isInitialized="isInitialized"
        :isLoading="isLoading"
        :isRunning="isRunning"
        :isFinished="isFinished"
        :canGoNext="canGoNext"
        :canGoPrev="canGoPrev"
        :currentStep="currentStep"
        :language="language"
        :sidebarOpen="sidebarOpen"
        @init="initEngine"
        @next="handleNext"
        @prev="handlePrev"
        @reset="handleReset"
        @toggleRun="handleToggleRun"
        @toggleSidebar="sidebarOpen = !sidebarOpen"
        @update:language="language = $event"
    />

    <div class="workspace">
      <AppSidebar
          :open="sidebarOpen"
          :executionSpeed="executionSpeed"
          :sourceCode="sourceCode"
          :codeExamples="CODE_EXAMPLES"
          :kindStyles="kindStyles"
          :kindLabel="kindLabel"
          @update:executionSpeed="executionSpeed = $event"
          @loadExample="loadExample"
      />

      <main class="main">
        <div class="panel-container" ref="panelContainer">

          <EditorPanel
              v-model="sourceCode"
              :language="language"
              :codeLines="codeLines"
              :isRunning="isRunning"
              :errorMessage="errorMessage"
              :style="{ flexBasis: editorWidth + '%' }"
              @invalidate="handleInvalidate"
          />

          <div class="resizer" @mousedown="(e) => onResizerMouseDown(e, 'left')">
            <div class="resizer-handle"></div>
          </div>

          <ConsolePanel
              :consoleLog="consoleLog"
              :style="{ flexBasis: consoleWidth + '%' }"
              @clear="consoleLog = []"
          />

          <div class="resizer" @mousedown="(e) => onResizerMouseDown(e, 'right')">
            <div class="resizer-handle"></div>
          </div>

          <VariablesPanel
              :currentState="currentState"
              :currentStep="currentStep"
              :isInitialized="isInitialized"
              :kindStyles="kindStyles"
              :style="{ flex: 1 }"
          />

        </div>
      </main>
    </div>
  </div>
</template>
