<script>
import { RouterLink } from '../../node_modules/vue-router/dist/vue-router';


</script>
<template>
    <aside id="logo-sidebar" class="fixed top-0 left-0 z-40 w-64 h-screen pt-20 transition-transform -translate-x-full bg-white border-r border-gray-200 sm:translate-x-0 dark:bg-gray-800 dark:border-gray-700" aria-label="Sidebar">
   <div class="h-full px-3 pb-4 overflow-y-auto bg-white dark:bg-gray-800">
      <ul class="space-y-2 font-medium">
         <li>
            <RouterLink to="" class="link">
               <i class="fa-solid fa-chart-pie icon"></i>
               <span class="ms-3">Dashboard</span>
            </RouterLink>
         </li>
         <li>
            <button type="button" class="flex items-center w-full p-2 text-base text-gray-900 transition duration-75 rounded-lg group hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700" aria-controls="dropdown-example" data-collapse-toggle="dropdown-example">
                  <i class="fa-solid fa-users icon"></i>
                  <span class="flex-1 ms-3 text-left rtl:text-right whitespace-nowrap">Users</span>
                  <i class="fa-solid fa-caret-down"></i>
            </button>
            <ul id="dropdown-example" class="hidden py-2 space-y-2">
                  <li>
                     <RouterLink href="#" class="link-dropdown group">Admin</RouterLink>
                  </li>
                  <li>
                     <RouterLink href="#" class="link-dropdown group">Teacher</RouterLink>
                  </li>
                  <li>
                     <RouterLink href="#" class="link-dropdown group">Examinee</RouterLink>
                  </li>
            </ul>
         </li>
         <li>
            <button type="button" class="flex items-center w-full p-2 text-base text-gray-900 transition duration-75 rounded-lg group hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700" aria-controls="dropdown-ujian" data-collapse-toggle="dropdown-ujian">
                  <i class="fa-solid fa-file-lines icon"></i>
                  <span class="flex-1 ms-3 text-left rtl:text-right whitespace-nowrap">Exams</span>
                  <i class="fa-solid fa-caret-down"></i>
            </button>
            <ul id="dropdown-ujian" class="hidden py-2 space-y-2">
                  <li>
                     <RouterLink href="#" class="link-dropdown group">Exam</RouterLink>
                  </li>
                  <li>
                     <RouterLink href="#" class="link-dropdown group">Schedule</RouterLink>
                  </li>
                  <li>
                     <RouterLink href="#" class="link-dropdown group">Scores</RouterLink>
                  </li>
            </ul>
         </li>
         <li>
            <RouterLink href="#" class="link">
               <i class="fa-solid fa-boxes-stacked icon"></i>
               <span class="flex-1 ms-3 whitespace-nowrap">Kanban</span>
               <span class="inline-flex items-center justify-center px-2 ms-3 text-sm font-medium text-gray-800 bg-gray-100 rounded-full dark:bg-gray-700 dark:text-gray-300">Pro</span>
            </RouterLink>
         </li>
         <li>
            <RouterLink href="#" class="link">
               <i class="fa-solid fa-people-roof icon"></i>
               <span class="flex-1 ms-3 whitespace-nowrap">Classes</span>
               <span class="inline-flex items-center justify-center w-3 h-3 p-3 ms-3 text-sm font-medium text-blue-800 bg-blue-100 rounded-full dark:bg-blue-900 dark:text-blue-300">9+</span>
            </RouterLink>
         </li>
         <li>
            <a href="#" class="link">
               <i class="fa-solid fa-user-plus icon"></i>
               <span class="flex-1 ms-3 whitespace-nowrap">Sign Up</span>
            </a>
         </li>
      </ul>
   </div>
</aside>
</template>
<style scoped>
.link-dropdown{
   @apply flex items-center w-full p-2 text-gray-900 transition duration-75 rounded-lg pl-11 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700
}
.link{
  @apply flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700
}
.icon{
   @apply text-gray-500 transition duration-75 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white
}
</style>