<template>
<Toast/>
<form @submit.prevent="login">
<div class="card">
    <div class="flex flex-col gap-2 m-2">
        <div class="flex flex-col gap-2">
            <label for="username">Username</label>
            <InputText id="username" v-model="username" aria-describedby="username-help" />
        </div>
    </div>  
    <div class="flex flex-col gap-2 m-2">
        <div class="flex flex-col gap-2">
            <label for="username">Password</label>
            <Password v-model="password" :feedback="false"/>
        </div>
    </div>
    <div class="flex flex-row gap-2 m-2">
        <Button label="Submit" icon="fa-solid fa-arrow-right" iconPos="right" @click="login()" severity="contrast"/>
    </div>
</div>
</form>
</template>
<script>
import { useUserData } from '@/stores/Users'
import Button from 'primevue/button'
import Toast from 'primevue/toast'
import Message from 'primevue/message'
import InputText from 'primevue/inputtext'

export default{
    data(){
        return{
            username: '',
            password: ''
        }
    },
    methods:{
        async login() {
            const userData = useUserData();
            try {
                await userData.authLogin(this.username, this.password);
                this.toast(userData.message.severity,userData.message.message,userData.message.summary);
                
            } catch (error) {
                this.toast('warn','An error occurred during login','Oops');
            }
        },
        toast(status,message,summary){
            this.$toast.add({ severity: status, summary: summary, detail: message, life: 3000 });
        }
    },
    component:{
        Button,Toast,InputText,Message
    },
    mounted(){
    }
}
</script>