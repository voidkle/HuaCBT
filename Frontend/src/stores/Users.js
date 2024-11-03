import { defineStore } from "pinia";
import axios from "axios";
import router from "@/router/index";
const API_URL = import.meta.env.VITE_RESTAPI_URL;
export const useUserData = defineStore(
    {
        id:'auth',
        state : () => ({
            user : JSON.parse(localStorage.getItem('token')),
            userData : {
                username: null,
                password: null,
                nis: null,
                kelas: null,
                nama: null
            },
            returnUrl : null,
            message: {
                summary: null,
                message: null,
                severity: null,
            } 
        }),
        getters: {
            getUsers(state){
                return state.users
            }
        },
        actions: {
            async authLogin(username, password){
                try{
                    const user = await axios.post(API_URL + 'login', {username:username, password:password})
                    this.user = user;
                    localStorage.setItem('token', JSON.stringify(user.data.token))
                    this.message = {
                        message :"Login Success, you'll be redirected",
                        summary :"Success",
                        severity :"success"
                    }
                }
                catch(e){
                    e = e.message
                    this.message = {
                        message: e,
                        summary: "Error",
                        severity:"error"
                    }
                }
            },
            logout(){
                const user = this.userData;
                if (!user) {
                    router.push('login');
                    this.message = {
                        message: "Please Log In First before proceeding",
                        summary: "Warn",
                        severity: "warn"
                    };
                } else {
                    this.user = null;
                    localStorage.removeItem('token');
                    router.push('login');
                    this.returnUrl = null;
                    this.message = {
                        message: "Successfully Logged Out",
                        summary: "Success",
                        severity: "success"
                    };
                }
            },
            async fetchUser(){
                const user = this.userData
                if(user == null){
                    router.push('login')
                    this.message = {
                        message: "Please Log In First before proceeding",
                        summary: "Warn",
                        severity: "warn"
                    };
                }
                else{
                    try {
                        const data = await axios.get(API_URL + 'users')
                        this.userData = data
                    } catch (e) {
                        console.log(e) 
                    }
                }
            }
        }
    }
) 