import type { Component } from "vue";
import {
  BookOpen,
  ClipboardList,
  NotebookPen,
  Fingerprint,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  School,
  Presentation,
  Settings,
  Video,
} from "lucide-vue-next";
import type { Role } from "@/features/auth/types";

export interface NavItem {
  title: string;
  icon: Component;
  /** Route path; items without one are planned features and render disabled. */
  to?: string;
  /** Visible to these roles only; omitted = everyone. */
  roles?: Role[];
  /** Shows a live count next to the item (resolved in AppSidebar). */
  badgeKey?: "chat";
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Belajar",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, to: "/" },
      { title: "Kelas & Jadwal", icon: School, to: "/classes" },
      { title: "Tugas", icon: NotebookPen, to: "/assignments", roles: ["admin", "operator", "teacher", "student"] },
      { title: "E-Book", icon: BookOpen, to: "/ebooks" },
      { title: "Video Kursus", icon: Video, to: "/videos" },
      { title: "Presentasi", icon: Presentation, to: "/presentations" },
    ],
  },
  {
    label: "Komunikasi",
    items: [
      { title: "Chat", icon: MessageSquare, to: "/chat", badgeKey: "chat" },
      { title: "Mading", icon: Megaphone, to: "/mading" },
    ],
  },
  {
    label: "Ujian & Presensi",
    items: [
      { title: "Ujian (CBT)", icon: ClipboardList, to: "/cbt" },
      { title: "Presensi", icon: Fingerprint, to: "/presence", roles: ["admin", "operator", "teacher", "student"] },
    ],
  },
];

/** Pinned to the bottom of the sidebar. */
export const footerItems: NavItem[] = [{ title: "Pengaturan", icon: Settings, to: "/config", roles: ["admin", "operator"] }];
