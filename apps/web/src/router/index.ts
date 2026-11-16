import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import type { Role } from "@/features/auth/types";
import { useBrandingStore } from "@/features/config/stores/useBrandingStore";

declare module "vue-router" {
  interface RouteMeta {
    public?: boolean;
    title?: string;
    /** Only these roles may open the route; others are sent to the dashboard. */
    roles?: Role[];
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", name: "login", component: () => import("@/pages/LoginPage.vue"), meta: { public: true, title: "Masuk" } },
    {
      path: "/",
      component: () => import("@/components/layout/AppShell.vue"),
      children: [
        { path: "", name: "dashboard", component: () => import("@/pages/DashboardPage.vue"), meta: { title: "Dashboard" } },
        { path: "ebooks", name: "ebooks", component: () => import("@/pages/EbooksPage.vue"), meta: { title: "E-Book" } },
        { path: "videos", name: "videos", component: () => import("@/pages/VideosPage.vue"), meta: { title: "Video Kursus" } },
        { path: "videos/:id", name: "video-watch", component: () => import("@/pages/VideoWatchPage.vue"), meta: { title: "Video Kursus" } },
        { path: "classes", name: "classes", component: () => import("@/pages/ClassesPage.vue"), meta: { title: "Kelas & Jadwal" } },
        { path: "assignments", name: "assignments", component: () => import("@/pages/AssignmentsPage.vue"), meta: { title: "Tugas", roles: ["admin", "operator", "teacher", "student"] } },
        { path: "assignments/:id", name: "assignment", component: () => import("@/pages/AssignmentDetailPage.vue"), meta: { title: "Tugas", roles: ["admin", "operator", "teacher", "student"] } },
        { path: "presence", name: "presence", component: () => import("@/pages/PresencePage.vue"), meta: { title: "Presensi", roles: ["admin", "operator", "teacher", "student"] } },
        { path: "presentations", name: "presentations", component: () => import("@/pages/PresentationsPage.vue"), meta: { title: "Presentasi" } },
        { path: "cbt", name: "cbt", component: () => import("@/pages/CbtPage.vue"), meta: { title: "Ujian" } },
        { path: "cbt/exams/:id/edit", name: "cbt-edit", component: () => import("@/pages/ExamEditPage.vue"), meta: { title: "Edit ujian", roles: ["admin", "operator", "teacher"] } },
        { path: "cbt/exams/:id/results", name: "cbt-results", component: () => import("@/pages/ExamResultsPage.vue"), meta: { title: "Hasil ujian", roles: ["admin", "operator", "teacher"] } },
        { path: "cbt/attempts/:id/grade", name: "cbt-grade", component: () => import("@/pages/GradingPage.vue"), meta: { title: "Penilaian", roles: ["admin", "operator", "teacher"] } },
        { path: "cbt/attempts/:id/result", name: "cbt-result", component: () => import("@/pages/ExamResultPage.vue"), meta: { title: "Hasil ujian", roles: ["student"] } },
        { path: "chat", name: "chat", component: () => import("@/pages/ChatPage.vue"), meta: { title: "Chat" } },
        { path: "chat/:roomId", name: "chat-room", component: () => import("@/pages/ChatPage.vue"), meta: { title: "Chat" } },
        { path: "mading", name: "mading", component: () => import("@/pages/MadingPage.vue"), meta: { title: "Mading" } },
        { path: "config", name: "config", component: () => import("@/pages/ConfigPage.vue"), meta: { title: "Pengaturan", roles: ["admin", "operator"] } },
      ],
    },
    // full-screen exam: no sidebar, nothing to distract; only students take exams
    { path: "/cbt/attempts/:id", name: "cbt-take", component: () => import("@/pages/ExamTakePage.vue"), meta: { title: "Ujian", roles: ["student"] } },
    // full-screen slide viewer, outside the shell like the e-book reader. ?page=N opens at that slide.
    { path: "/presentations/:id", name: "presentation-viewer", component: () => import("@/pages/PresentationViewerPage.vue"), meta: { title: "Presentasi" } },
    // full-screen reader: deliberately outside the sidebar shell. ?page=N opens at that page.
    { path: "/ebooks/:id", name: "ebook-reader", component: () => import("@/pages/EbookReaderPage.vue"), meta: { title: "E-Book" } },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await Promise.all([auth.load(), useBrandingStore().load()]);
  if (!to.meta.public && !auth.isLoggedIn) return { name: "login" };
  if (to.name === "login" && auth.isLoggedIn) return { name: "dashboard" };
  if (to.meta.roles && !auth.hasRole(...to.meta.roles)) return { name: "dashboard" };
});

export default router;
