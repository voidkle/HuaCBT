import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { API_URL } from "@/services/api";
import { fetchPublicConfig } from "../services/configApi";
import type { PublicConfig } from "../types";

/** Site title, logo and footer holder: loaded once at startup, updated live when the config page saves. */
export const useBrandingStore = defineStore("branding", () => {
  const siteTitle = ref("HuaEBL");
  const copyrightHolder = ref("huacbt");
  const logoUrl = ref<string | null>(null);
  const loaded = ref(false);

  const logoSrc = computed(() => (logoUrl.value ? API_URL + logoUrl.value : null));

  function apply(config: PublicConfig) {
    siteTitle.value = config.siteTitle;
    copyrightHolder.value = config.copyrightHolder;
    logoUrl.value = config.logoUrl;
  }

  async function load() {
    if (loaded.value) return;
    try {
      apply(await fetchPublicConfig());
    } catch {
      /* API unreachable: keep the defaults so the app still renders */
    }
    loaded.value = true;
  }

  return { siteTitle, copyrightHolder, logoUrl, logoSrc, load, apply };
});
