<template>
<div class="mx-2 justify-between flex flex-col max-w-sm p-6 my-2 md:my-0 bg-white border border-gray-200 rounded-lg shadow dark:bg-gray-800 dark:border-gray-700">
  <div class="flex-col">
    <i :class="'fa-solid fa-lg text-gray-500 dark:text-gray-400 mb-6 fa-'+icon"></i> 
        <h5 class="mb-2 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ title }}</h5>
    <p class="mb-3 font-normal text-gray-500 dark:text-gray-400">{{ description }}</p>
  </div>
    <RouterLink :to="link" class="flex font-medium items-center text-blue-600 hover:underline">
      <div class="flex flex-row items-center">
        Go
        <i class="fa-solid fa-arrow-right ms-2"></i>
      </div>
    </RouterLink>
</div>
</template>
<script>
export default{
    props: {
    icon:{
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    link: {
      type: String,
      required: true
    }
  },
    data(){
        return{

        }
    },
    methods: {
        
    },
    mounted(){

    }
}
</script>