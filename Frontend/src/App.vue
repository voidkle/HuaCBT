<script>
import { RouterView } from 'vue-router';
import { initFlowbite } from 'flowbite';
import Navbar from './components/Navbar.vue'
import Sidebar from './components/Sidebar.vue'
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
    initFlowbite();
  }
}
</script>

<template>
<RouterView></RouterView>
</template>

<style scoped>

</style>
