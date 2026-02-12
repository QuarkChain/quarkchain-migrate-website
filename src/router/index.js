import { createRouter, createWebHistory } from 'vue-router'
import MigrationPage from '../views/MigrationPage.vue'
import BridgePage from '../views/BridgePage.vue'

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
