import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../auth'
import DashboardView from '../views/DashboardView.vue'
import BoardView from '../views/BoardView.vue'
import BudgetView from '../views/BudgetView.vue'
import LoginView from '../views/LoginView.vue'
import NotesView from '../views/NotesView.vue'
import RegisterView from '../views/RegisterView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/calendar',
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { guestOnly: true },
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterView,
      meta: { guestOnly: true },
    },
    {
      path: '/calendar',
      name: 'calendar',
      component: DashboardView,
      meta: { requiresAuth: true },
    },
    {
      path: '/board',
      name: 'board',
      component: BoardView,
      meta: { requiresAuth: true },
    },
    {
      path: '/budget',
      name: 'budget',
      component: BudgetView,
      meta: { requiresAuth: true },
    },
    {
      path: '/notes',
      name: 'notes',
      component: NotesView,
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to) => {
  const { isAuthenticated } = useAuth()

  if (to.meta.requiresAuth && !isAuthenticated.value) {
    return { name: 'login' }
  }

  if (to.meta.guestOnly && isAuthenticated.value) {
    return { name: 'calendar' }
  }
})

export default router
