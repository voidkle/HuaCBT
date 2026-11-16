export interface Ebook {
  id: number;
  title: string;
  description: string;
  sizeBytes: number;
  pageCount: number;
  hasCover: boolean;
  createdAt: string;
  uploader: { id: number; name: string } | null;
  /** The signed-in user's last page, or null if they never opened it. */
  progressPage: number | null;
}

export interface EbookUploadInput {
  file: File;
  cover?: File;
  title: string;
  description: string;
  pageCount: number;
}

/** flip = page-curl book, scroll = continuous vertical (manhwa), page = one page, tap/swipe (manga) */
export type ReaderMode = "flip" | "scroll" | "page";

export const READER_MODES: readonly ReaderMode[] = ["flip", "scroll", "page"];
