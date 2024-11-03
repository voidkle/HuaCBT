import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import  PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice'
import DialogService from 'primevue/dialogservice'
import Aura from '@primevue/themes/aura'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(ConfirmationService);
app.use(ToastService);
app.use(DialogService);
app.use(createPinia())
app.use(PrimeVue, {
    theme:{
        preset: Aura
    }
})
app.use(router)
app.mount('#app')
