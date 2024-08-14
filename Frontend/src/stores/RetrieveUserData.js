import { defineStore, mapState } from "pinia";
import axios from "axios";
let defurl = 'http://localhost:8000/api/'; 
export const userData = defineStore("user",
    {
        state : () => ({
            users: []
        }),
        getters: {
            getUsers(state){
                return state.users
            }
        },
        actions: {
            async fetchUser(){
                try {
                    const data = await axios.get(defurl + 'users')
                    this.users = data
                } catch (e) {
                    console.log(e)     
                }
            }
        }
    }
) 