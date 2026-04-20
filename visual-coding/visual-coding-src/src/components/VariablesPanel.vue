<script setup>
import {ref, computed, watch} from 'vue'

const props = defineProps({
  currentState: Object,
  currentStep: Number,
  isInitialized: Boolean,
  kindStyles: Object,
})

// ── SVG 화살표
const varBoxRefs = ref({})
const arrowPaths = ref([])
const vizContainer = ref(null)

const pointerVariables = computed(() => {
  if (!props.currentState) return []
  return props.currentState.callStack
      .flatMap(f => f.variables)
      .filter(v => v.kind === 'pointer')
})

function registerVarBox(el, name) {
  if (el) varBoxRefs.value[name] = el
  else delete varBoxRefs.value[name]
}

async function recalcArrows() {
  await Promise.resolve() // nextTick equivalent without import
  if (!vizContainer.value) return
  const containerRect = vizContainer.value.getBoundingClientRect()
  const paths = []
  for (const pointer of pointerVariables.value) {
    const targets = Array.isArray(pointer.pointsTo) ? pointer.pointsTo : [pointer.pointsTo]
    for (const targetName of targets) {
      const fromEl = varBoxRefs.value[pointer.name]
      const toEl = varBoxRefs.value[targetName]
      if (!fromEl || !toEl) continue
      const fromRect = fromEl.getBoundingClientRect()
      const toRect = toEl.getBoundingClientRect()
      const x1 = fromRect.right - containerRect.left
      const y1 = fromRect.top + fromRect.height / 2 - containerRect.top
      const x2 = toRect.left - containerRect.left
      const y2 = toRect.top + toRect.height / 2 - containerRect.top
      const cx = (x2 - x1) * 0.5
      paths.push({
        id: `${pointer.name}->${targetName}`,
        d: `M ${x1} ${y1} C ${x1 + cx} ${y1}, ${x2 - cx} ${y2}, ${x2} ${y2}`,
      })
    }
  }
  arrowPaths.value = paths
}

watch(() => props.currentState, recalcArrows, {flush: 'post'})

// ── 변경 감지
const prevVariables = ref({})
const variableChangeMap = ref({})

watch(() => props.currentState, (newState) => {
  if (!newState) return
  const next = {}
  newState.callStack.forEach(frame => {
    frame.variables.forEach(v => {
      const key = `${frame.frameId}:${v.name}`
      const prev = prevVariables.value[key]
      if (!prev) {
        variableChangeMap.value[key] = 'new'
      } else {
        const prevVal = JSON.stringify(prev.value ?? prev.elements ?? prev.properties)
        const nextVal = JSON.stringify(v.value ?? v.elements ?? v.properties)
        variableChangeMap.value[key] = prevVal !== nextVal ? 'changed' : 'same'
      }
      next[key] = v
    })
  })
  Object.keys(prevVariables.value).forEach(k => {
    if (!next[k]) variableChangeMap.value[k] = 'deleted'
  })
  prevVariables.value = next
  setTimeout(() => {
    Object.keys(variableChangeMap.value).forEach(k => {
      if (variableChangeMap.value[k] !== 'deleted') variableChangeMap.value[k] = 'same'
    })
  }, 1500)
})

function getVarChangeClass(frameId, varName) {
  return variableChangeMap.value[`${frameId}:${varName}`] ?? 'same'
}
</script>

<template>
  <div class="panel variables">
    <div class="panel-header">
      <span class="panel-icon">📊</span>
      <span class="panel-title">변수 상태</span>
      <span class="panel-hint" v-if="currentState">Step {{ currentStep }}</span>
    </div>

    <!-- 빈 상태 -->
    <div v-if="!isInitialized && !currentState" class="vars-empty">
      <div class="empty-icon">🧠</div>
      <p>Run 버튼 후 Step으로<br>실행을 시작하세요.</p>
    </div>

    <!-- 변수 테이블 -->
    <div v-else class="vars-body">

      <!-- 콜스택 프레임 -->
      <div
          v-for="frame in currentState?.callStack ?? []"
          :key="frame.frameId"
          class="frame-block"
      >
        <div class="frame-label">
          <span class="frame-badge">FRAME</span>
          {{ frame.frameName }}
        </div>
        <table class="var-table">
          <thead>
          <tr><th>변수명</th><th>값</th><th>타입</th></tr>
          </thead>
          <tbody>
          <tr
              v-for="variable in frame.variables"
              :key="variable.name"
              :ref="(el) => registerVarBox(el, variable.name)"
              class="var-row"
              :class="`var-row--${getVarChangeClass(frame.frameId, variable.name)}`"
          >
            <td class="var-name-cell">
              <span class="var-kind-dot"
                    :style="{ background: kindStyles[variable.kind]?.border ?? '#64748b' }"></span>
              <span class="var-name-text">{{ variable.name }}</span>
            </td>
            <td class="var-val-cell">
              <span v-if="variable.kind === 'primitive'" class="val-primitive">{{ variable.value }}</span>
              <span v-else-if="variable.kind === 'array'" class="val-array">
                [<span v-for="(el, i) in variable.elements" :key="el.index"
                >{{ el.value }}<span v-if="i < variable.elements.length - 1">, </span></span>]
              </span>
              <span v-else-if="variable.kind === 'object'" class="val-object">
                {<span v-for="(p, i) in variable.properties" :key="p.key"
                ><span class="prop-k">{{ p.key }}</span>: {{ p.value
                }}<span v-if="i < variable.properties.length - 1">, </span></span>}
              </span>
              <span v-else-if="variable.kind === 'pointer'" class="val-pointer">→ {{ variable.pointsTo }}</span>
            </td>
            <td class="var-type-cell">
              <span class="type-chip"
                    :style="{ borderColor: kindStyles[variable.kind]?.border ?? '#64748b', color: kindStyles[variable.kind]?.border ?? '#64748b' }">
                {{ variable.type }}
              </span>
            </td>
          </tr>
          </tbody>
        </table>
      </div>

      <!-- 힙 -->
      <div v-if="currentState?.heap?.length" class="frame-block heap-block">
        <div class="frame-label">
          <span class="frame-badge heap-badge">HEAP</span>
          동적 할당 영역
        </div>
        <table class="var-table">
          <thead><tr><th>ID</th><th>값</th><th>타입</th></tr></thead>
          <tbody>
          <tr v-for="obj in currentState.heap" :key="obj.id"
              :ref="(el) => registerVarBox(el, obj.id)"
              class="var-row">
            <td class="var-name-cell"><span class="var-name-text heap-id">{{ obj.id }}</span></td>
            <td class="var-val-cell"><span class="val-primitive">{{ obj.value }}</span></td>
            <td class="var-type-cell">
              <span class="type-chip" style="border-color:#2dd4bf;color:#2dd4bf">{{ obj.type }}</span>
            </td>
          </tr>
          </tbody>
        </table>
      </div>

      <!-- SVG 화살표 -->
      <div ref="vizContainer" class="arrow-layer">
        <svg class="arrow-svg" aria-hidden="true" v-if="arrowPaths.length">
          <defs>
            <marker id="ah" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#fb7185"/>
            </marker>
          </defs>
          <g v-for="a in arrowPaths" :key="a.id">
            <path :d="a.d" class="arrow-path" marker-end="url(#ah)"/>
          </g>
        </svg>
      </div>

    </div>
  </div>
</template>
