import { defineAsyncComponent } from 'vue';
import { createRouter, createWebHistory } from 'vue-router'
const i = "HuaCBT | "
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Home',
      meta: {
        name:i+"Dashboard"
      },
      component: defineAsyncComponent(() => import('../layout/BaseLayout.vue')),
      children:[
        {
          path:'',
          name: 'Dashboard',
          meta: {
            name:i+"Dashboard"
          },
          component: defineAsyncComponent(() => import('../views/HomeView.vue'))
        }
      ]
    },
    {
      path: '/auth',
      name: 'Login',
      meta: {
        name: i+"Login"
      },
      component: defineAsyncComponent(() => import('../layout/AuthLayout.vue')),
      children:[
        {
          path:'/login',
          name: 'Login',
          meta: {
            name:i+"Login"
          },
          component: defineAsyncComponent(() => import('../views/LoginView.vue'))
        },
        {
          path:'/register',
          name:'Register',
          meta: {
            name:i+'Register'
          },
          component: defineAsyncComponent(() => import('../views/RegisterView.vue'))
        }
      ]
    }
  ]
})

router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.name}`;
  next();
})

export default router
