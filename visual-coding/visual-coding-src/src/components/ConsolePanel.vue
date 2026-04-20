<script setup>
defineProps({
  consoleLog: Array,  // [{ id, type, text }]
})

const emit = defineEmits(['clear'])
</script>

<template>
  <div class="panel console">
    <div class="panel-header">
      <span class="panel-icon">🖥</span>
      <span class="panel-title">실행 콘솔</span>
      <button class="clear-btn" @click="emit('clear')" title="콘솔 지우기">✕</button>
    </div>

    <div class="console-body">
      <div
          v-for="entry in consoleLog"
          :key="entry.id"
          class="log-entry"
          :class="`log-${entry.type}`"
      >
        <span class="log-prefix">{{ entry.type === 'error' ? '✕' : entry.type === 'log' ? '›' : '·' }}</span>
        <span class="log-text">{{ entry.text }}</span>
      </div>
      <div v-if="consoleLog.length === 0" class="console-empty">
        콘솔 출력이 여기에 표시됩니다.
      </div>
    </div>
  </div>
</template>
