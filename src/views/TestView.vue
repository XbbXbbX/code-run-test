<template>
  <div style="padding: 2rem; text-align: center">
    <h2>这是测试视图</h2>
    <p>你可以点击上方按钮切换回 Thebe 演示页面。</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

onMounted(() => {
  console.log('TestView mounted')
})
onUnmounted(() => {
  console.log('TestView unmounted')
})
</script>