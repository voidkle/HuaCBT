import { computed, ref, watchEffect } from "vue";

type Theme = "light" | "dark";
const KEY = "hua-theme"; // keep in sync with the inline script in index.html (prevents a flash of the wrong theme)

const read = (): Theme => {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* storage blocked: fall through to the system preference */
  }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const theme = ref<Theme>(read());

watchEffect(() => {
  document.documentElement.classList.toggle("dark", theme.value === "dark");
  try {
    localStorage.setItem(KEY, theme.value);
  } catch {
    /* ignore */
  }
});

export function useTheme() {
  const isDark = computed(() => theme.value === "dark");
  const toggle = () => {
    theme.value = isDark.value ? "light" : "dark";
  };
  return { isDark, toggle };
}
