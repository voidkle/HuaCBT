<template>
<Navbar></Navbar>
<Sidebar></Sidebar>
<div class="p-4 sm:ml-64 h-[100vh]">
  <div class="p-4 border-2 border-gray-200 border-dashed rounded-lg dark:border-gray-700 mt-14">
    <RouterView></RouterView>
  </div>
</div>
</template>
<script>
import { RouterView } from 'vue-router';
import Sidebar from '../components/Sidebar.vue'
import Navbar from '../components/Navbar.vue'
export default{
  
  data(){
    return {

    }
  },

  methods:{

  },

  components:{
      Navbar,
      Sidebar
  },

  mounted(){
    
  }
}
</script>