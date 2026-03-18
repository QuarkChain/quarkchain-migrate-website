import { createRouter, createWebHistory } from 'vue-router'
import BridgePage from '@/ui/views/BridgePage.vue'

const routes = [
  { path: '/', component: BridgePage },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
