<script setup>
defineProps({
  modelValue: String,   // sourceCode (v-model)
  language: String,
  codeLines: Array,     // [{ number, text, isActive }]
  isRunning: Boolean,
  errorMessage: String,
})

const emit = defineEmits(['update:modelValue', 'invalidate'])
</script>

<template>
  <div class="panel editor">
    <div class="panel-header">
      <span class="panel-icon">📝</span>
      <span class="panel-title">코드 에디터</span>
      <span class="panel-lang">{{ language }}</span>
    </div>

    <div class="editor-wrap">
      <!-- 줄번호 거터 -->
      <div class="line-gutter" aria-hidden="true">
        <div
            v-for="line in codeLines"
            :key="line.number"
            class="gutter-row"
            :class="{ 'gutter-row--active': line.isActive }"
        >
          <span class="gutter-num">{{ line.number }}</span>
          <span v-if="line.isActive" class="exec-arrow">▶</span>
        </div>
      </div>

      <!-- 코드 입력 -->
      <textarea
          :value="modelValue"
          @input="emit('update:modelValue', $event.target.value); emit('invalidate')"
          class="code-area"
          spellcheck="false"
          autocomplete="off"
          placeholder="여기에 Python 코드를 입력하세요..."
          :readonly="isRunning"
      />
    </div>

    <!-- 에러 바 -->
    <div v-if="errorMessage" class="error-bar">
      <span class="err-icon">⚠</span>
      {{ errorMessage }}
    </div>
  </div>
</template>
