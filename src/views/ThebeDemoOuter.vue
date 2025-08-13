<template>
  <div>
    <button @click="showThebeDemo = !showThebeDemo" style="margin-bottom: 1rem">
      {{ showThebeDemo ? '切换到新视图' : '返回 Thebe 演示' }}
    </button>
    <ThebeDemo v-if="showThebeDemo" />
    <TestView v-else />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ThebeDemo from './ThebeDemo.vue'
import TestView from './TestView.vue'

const showThebeDemo = ref(false)
</script>
