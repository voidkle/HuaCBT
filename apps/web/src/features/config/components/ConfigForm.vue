<script setup lang="ts">
import { Loader2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfigForm } from "../composables/useConfigForm";
import BrandingSection from "./BrandingSection.vue";
import FeaturesSection from "./FeaturesSection.vue";
import LimitsSection from "./LimitsSection.vue";
import VideoAiSection from "./VideoAiSection.vue";

const { saved, draft, loading, error, saving, logoBusy, dirty, load, save, reset, changeLogo, deleteLogo } = useConfigForm();
</script>

<template>
  <div v-if="loading" class="flex max-w-3xl flex-col gap-3" aria-busy="true">
    <Skeleton class="h-72 rounded-xl" />
    <Skeleton class="h-40 rounded-xl" />
    <Skeleton class="h-40 rounded-xl" />
  </div>

  <div v-else-if="error || !draft || !saved" class="flex flex-col items-center gap-3 py-16 text-center" role="alert">
    <p class="text-destructive text-sm">{{ error ?? "Pengaturan tidak tersedia." }}</p>
    <Button variant="outline" @click="load">Coba lagi</Button>
  </div>

  <form v-else class="flex max-w-3xl flex-col gap-3 pb-2" @submit.prevent="save">
    <BrandingSection
      v-model:site-title="draft.siteTitle"
      v-model:copyright-holder="draft.copyrightHolder"
      :logo-url="saved.logoUrl"
      :logo-busy="logoBusy"
      @upload="changeLogo"
      @remove="deleteLogo"
    />
    <LimitsSection
      v-model:max-video-mb="draft.maxVideoMb"
      v-model:max-ppt-mb="draft.maxPptMb"
      v-model:max-ebook-mb="draft.maxEbookMb"
      v-model:max-chat-media-mb="draft.maxChatMediaMb"
      v-model:max-assignment-mb="draft.maxAssignmentMb"
    />
    <FeaturesSection
      v-model:class-system="draft.classSystem"
      v-model:moving-class="draft.movingClass"
      v-model:biometrics-enabled="draft.biometricsEnabled"
      v-model:school-lat="draft.schoolLat"
      v-model:school-lng="draft.schoolLng"
      v-model:school-radius-m="draft.schoolRadiusM"
      v-model:ai-summary-enabled="draft.aiSummaryEnabled"
      v-model:ai-api-key="draft.aiApiKey"
      :ai-api-key-set="saved.aiApiKeySet"
    />
    <VideoAiSection
      v-model:transcription-enabled="draft.transcriptionEnabled"
      v-model:transcription-base-url="draft.transcriptionBaseUrl"
      v-model:transcription-model="draft.transcriptionModel"
      v-model:transcription-language="draft.transcriptionLanguage"
      v-model:transcription-api-key="draft.transcriptionApiKey"
      v-model:ai-base-url="draft.aiBaseUrl"
      v-model:ai-model="draft.aiModel"
      :transcription-api-key-set="saved.transcriptionApiKeySet"
    />

    <div class="bg-background/90 sticky bottom-0 -mx-1 flex items-center justify-end gap-2 border-t px-1 py-3 backdrop-blur">
      <span v-if="dirty" class="text-muted-foreground mr-auto text-xs">Ada perubahan yang belum disimpan.</span>
      <Button type="button" variant="outline" :disabled="!dirty || saving" @click="reset">Batal</Button>
      <Button type="submit" :disabled="!dirty || saving">
        <Loader2 v-if="saving" class="animate-spin" />
        Simpan
      </Button>
    </div>
  </form>
</template>
