import { onMounted, ref } from "vue";
import * as api from "../services/classesApi";
import type { ClassSystem } from "../types";

/** The school-wide setting from Config: which kind of class this school runs, and whether lessons may move to rooms. */
export function useClassMode() {
  const system = ref<ClassSystem>("subject_teachers");
  const moving = ref(false);
  const loaded = ref(false);

  async function load() {
    try {
      const m = await api.fetchMode();
      [system.value, moving.value] = [m.system, m.moving];
    } finally {
      loaded.value = true;
    }
  }

  onMounted(() => void load());

  return { system, moving, loaded, load };
}
