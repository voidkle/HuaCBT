// `page-flip` (StPageFlip) ships no TypeScript types; this covers only the API the reader uses.
declare module "page-flip/dist/js/page-flip.module.js" {
  export interface FlipSettings {
    width: number;
    height: number;
    size: "fixed" | "stretch";
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
    showCover: boolean;
    usePortrait: boolean;
    startPage: number;
    drawShadow: boolean;
    maxShadowOpacity: number;
    flippingTime: number;
    mobileScrollSupport: boolean;
    autoSize: boolean;
    swipeDistance: number;
  }

  export class PageFlip {
    constructor(element: HTMLElement, settings: Partial<FlipSettings>);
    loadFromHTML(pages: HTMLElement[]): void;
    on(event: "flip" | "changeOrientation" | "changeState", handler: (e: { data: number | string }) => void): PageFlip;
    flip(pageIndex: number): void;
    flipNext(): void;
    flipPrev(): void;
    turnToPage(pageIndex: number): void;
    getCurrentPageIndex(): number;
    getOrientation(): "portrait" | "landscape";
    update(): void;
    destroy(): void;
  }
}
