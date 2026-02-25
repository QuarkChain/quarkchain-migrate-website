import { createRouter, createWebHistory } from 'vue-router'
import MigrationPage from '@/ui/views/MigrationPage.vue'
import BridgePage from '@/ui/views/BridgePage.vue'

const routes = [
  { path: '/', redirect: '/migration' },
  { path: '/migration', component: MigrationPage },
  { path: '/bridge', component: BridgePage },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
