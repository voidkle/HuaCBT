<template>
<MenuBar :model="items">
    <template #start>
      <Avatar icon="fa-solid fa-user" shape="circle" size="large"/>
    </template>
    <template #item="{ item }">
        <RouterLink class="flex items-center flex-row justify-center" :to="item.route" custom>
          <span :class="item.icon" />
          <span class="ml-2">{{ item.label }}</span>
        </RouterLink>
    </template>
</MenuBar>
<RouterView></RouterView>
</template>
<script>
import { RouterView, RouterLink } from 'vue-router';
import MenuBar from 'primevue/menubar'
import Avatar from 'primevue/avatar';
// import { teacheritems, adminitems, useritems} from '@/layout/navbar.js'

export default{
    data() {
        return {
           items: [
          {
              label: 'Users',
              icon: 'fa-solid fa-paperclip',
              items: [
                  {
                      label: 'Styled',
                      route: '/theming/styled'
                  },
                  {
                      label: 'Unstyled',
                      route: '/theming/unstyled'
                  }
              ]
          },
          {
              label: 'Programmatic',
              icon: 'fa-solid fa-house',
              items: [
                  {
                      label:'d',
                      route:'s'
                  },
                  {
                      label:'d',
                      route:'s'
                  }
              ]
          },
          {
              label: 'External',
              icon: 'fa-solid fa-carrot',
              items: [
                  {
                      label: 'Styled',
                      route: '/theming/styled'
                  },
                  {
                      label: 'Unstyled',
                      route: '/theming/unstyled'
                  }
              ]
          }]
            // adminitems,
            // useritems,
            // teacheritems
        };
    },


  methods:{
  
  },
  computed:{
    
  },
  components:{
    MenuBar,
    Avatar
  },

  mounted(){
    
  }
}
</script>
<style scoped>
span {
  @apply cursor-pointer
}
</style>