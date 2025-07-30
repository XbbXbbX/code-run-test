<template>
  <header>
    <h1>我的 Vue 3 + Thebe.js 应用</h1>
  </header>

  <main>
    <p>欢迎来到我的交互式数字化教材。</p>

    <InteractiveBinderCode />

    <p>你可以在页面上与代码进行交互。</p>
  </main>
</template>

<script setup>
// 导入我们创建的组件
import InteractiveBinderCode from '../components/InteractiveBinderCode.vue'
</script>

<style>
/* 添加一些全局样式 */
main {
  padding: 2rem;
}
</style>
