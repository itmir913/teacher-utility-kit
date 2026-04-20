<script setup>
defineProps({
  open: Boolean,
  executionSpeed: Number,
  sourceCode: String,
  codeExamples: Array,
  kindStyles: Object,
  kindLabel: Object,
})

const emit = defineEmits(['update:executionSpeed', 'loadExample'])
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar--closed': !open }">
    <div class="sidebar-inner">

      <!-- 실행 속도 -->
      <div class="sb-section">
        <div class="sb-title">⏱ 실행 속도</div>
        <div class="speed-ctrl">
          <span class="speed-label">빠름</span>
          <input type="range" min="100" max="2000" step="100"
                 :value="executionSpeed"
                 @input="emit('update:executionSpeed', Number($event.target.value))"
                 class="speed-slider"/>
          <span class="speed-label">느림</span>
        </div>
        <div class="speed-val">딜레이: {{ executionSpeed }}ms</div>
      </div>

      <!-- 코드 예제 -->
      <div class="sb-section">
        <div class="sb-title">📚 코드 예제</div>
        <div class="example-list">
          <button
              v-for="ex in codeExamples"
              :key="ex.label"
              class="example-btn"
              :class="{ 'example-btn--active': sourceCode === ex.code }"
              @click="emit('loadExample', ex)"
          >
            {{ ex.label }}
          </button>
        </div>
      </div>

      <!-- 범례 -->
      <div class="sb-section">
        <div class="sb-title">🔖 변수 타입</div>
        <div class="legend-list">
          <div class="legend-item" v-for="(s, kind) in kindStyles" :key="kind">
            <span class="legend-dot" :style="{ background: s.border }"></span>
            <span class="legend-kind">{{ kindLabel[kind] }}</span>
            <span class="legend-name">{{ { primitive: '원시형', array: '배열', object: '객체', pointer: '포인터' }[kind] }}</span>
          </div>
        </div>
      </div>

    </div>
  </aside>
</template>
