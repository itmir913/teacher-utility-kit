<script setup>
defineProps({
  isInitialized: Boolean,
  isLoading: Boolean,
  isRunning: Boolean,
  isFinished: Boolean,
  canGoNext: Boolean,
  canGoPrev: Boolean,
  currentStep: Number,
  language: String,
  sidebarOpen: Boolean,
})

const emit = defineEmits([
  'init', 'next', 'prev', 'reset', 'toggleRun', 'toggleSidebar',
  'update:language', 'update:sidebarOpen',
])
</script>

<template>
  <header class="nav">
    <div class="nav-left">
      <button class="sidebar-toggle" @click="emit('toggleSidebar')"
              :title="sidebarOpen ? '사이드바 닫기' : '사이드바 열기'">
        <span class="toggle-icon">{{ sidebarOpen ? '◀' : '▶' }}</span>
      </button>
      <div class="brand">
        <span class="brand-icon">⟨/⟩</span>
        <span class="brand-name">VisualCode</span>
        <span class="brand-sub">메모리 시각화 도구</span>
      </div>
    </div>

    <div class="nav-center">
      <div class="exec-controls">
        <button class="ctrl-btn ctrl-run" @click="emit('init')" :disabled="isLoading" title="실행 준비 (Run)">
          <span class="ctrl-icon">⚡</span>
          <span>{{ isInitialized ? '재시작' : 'Run' }}</span>
        </button>
        <button class="ctrl-btn ctrl-step" @click="emit('next')" :disabled="!canGoNext || isLoading"
                title="한 단계 실행 (Step)">
          <span class="ctrl-icon">▶</span>
          <span>Step</span>
        </button>
        <button class="ctrl-btn ctrl-play" @click="emit('toggleRun')"
                :disabled="!isInitialized || isFinished" title="자동 실행 / 일시정지">
          <span class="ctrl-icon">{{ isRunning ? '⏸' : '▷▷' }}</span>
          <span>{{ isRunning ? 'Pause' : 'Auto' }}</span>
        </button>
        <button class="ctrl-btn ctrl-prev" @click="emit('prev')" :disabled="!canGoPrev || isLoading || isRunning"
                title="이전 단계 (Prev)">
          <span class="ctrl-icon">◀</span>
          <span>Prev</span>
        </button>
        <button class="ctrl-btn ctrl-reset" @click="emit('reset')" :disabled="isLoading" title="초기화 (Reset)">
          <span class="ctrl-icon">↺</span>
          <span>Reset</span>
        </button>
      </div>
    </div>

    <div class="nav-right">
      <div class="step-display">
        <span class="step-label">Step</span>
        <span class="step-num">{{ currentStep }}</span>
        <span v-if="isFinished" class="done-badge">완료</span>
        <span v-if="isRunning" class="run-badge">실행 중</span>
      </div>
      <select :value="language" @change="emit('update:language', $event.target.value)" class="lang-sel">
        <option value="python">🐍 Python</option>
        <option value="c" disabled>C (준비 중)</option>
        <option value="java" disabled>Java (준비 중)</option>
      </select>
    </div>
  </header>
</template>
