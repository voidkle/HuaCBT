import { formatDuration } from "@/utils/formatDuration";
import type { LinkTarget, MessageLink } from "../types";

/** Where a Linker card leads. One case per resource type (add new types here, in the API `makeLink`/`sendMessage` validation, and in `LinkPickerDialog`). */
export function linkHref(link: LinkTarget): string {
  switch (link.type) {
    case "ebook":
      return `/ebooks/${link.ref}?page=${link.page}`;
    case "video":
      return `/videos/${link.ref}?t=${link.page}`;
    case "slide":
      return `/presentations/${link.ref}?page=${link.page}`;
  }
}

/** `total` is only known on a received card: a deck without a slide count (Google Slides / Canva) always opens at its start. */
export function linkPositionLabel(link: LinkTarget & { total?: number | null }): string {
  switch (link.type) {
    case "ebook":
      return `Halaman ${link.page}`;
    case "video":
      return `Menit ${formatDuration(link.page)}`;
    case "slide":
      return link.total === null ? "Dari awal" : `Slide ${link.page}`;
  }
}

/** "dari 12 halaman" / "dari 12:34". */
export function linkTotalLabel(link: Pick<MessageLink, "type" | "total">): string {
  if (link.total === null) return "";
  return link.type === "video" ? `dari ${formatDuration(link.total)}` : link.type === "slide" ? `dari ${link.total} slide` : `dari ${link.total} halaman`;
}

export const linkTypeLabel = (type: LinkTarget["type"]) => (type === "video" ? "Video" : type === "slide" ? "Presentasi" : "E-book");
