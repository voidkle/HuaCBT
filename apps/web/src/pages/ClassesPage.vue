<script setup lang="ts">
import ClassAssignmentList from "@/features/assignments/components/ClassAssignmentList.vue";
import ClassesView from "@/features/classes/components/ClassesView.vue";
</script>

<template>
  <ClassesView>
    <template #class-extra="{ classroomId }"><ClassAssignmentList :classroom-id="classroomId" /></template>
  </ClassesView>
</template>
