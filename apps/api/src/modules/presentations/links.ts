export type LinkKind = "google" | "canva";

export interface ParsedLink {
  kind: LinkKind;
  /** Canonical page of the deck (what "open in a new tab" uses). Rebuilt from matched parts, never the raw input. */
  link: string;
  /** What the sandboxed iframe loads. */
  embed: string;
}

const ID = "[A-Za-z0-9_-]{8,200}";
const GOOGLE_PUBLISHED = new RegExp(`^/presentation/d/e/(2PACX-[A-Za-z0-9_-]{8,300})(?:/|$)`);
const GOOGLE_FILE = new RegExp(`^/presentation/d/(${ID})(?:/|$)`);
const CANVA = new RegExp(`^/design/(${ID})/(${ID})/(?:view|watch)/?$`);

/**
 * Accepts only Google Slides and Canva share links and rebuilds both URLs from the matched ids, so the iframe can only ever
 * load those two sites. Returns null for anything else (other hosts, http, credentials, ports, short links, edit-only links).
 */
export function parseSlideLink(raw: string): ParsedLink | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  if (u.hostname === "docs.google.com") {
    const pub = GOOGLE_PUBLISHED.exec(u.pathname);
    if (pub) {
      const base = `https://docs.google.com/presentation/d/e/${pub[1]}`;
      return { kind: "google", link: `${base}/pub`, embed: `${base}/embed?start=false&loop=false&delayms=3000` };
    }
    const file = GOOGLE_FILE.exec(u.pathname);
    if (file) {
      const base = `https://docs.google.com/presentation/d/${file[1]}`;
      return { kind: "google", link: `${base}/view`, embed: `${base}/embed?start=false&loop=false&delayms=3000` };
    }
    return null;
  }
  if (u.hostname === "www.canva.com" || u.hostname === "canva.com") {
    const m = CANVA.exec(u.pathname);
    if (!m) return null;
    const base = `https://www.canva.com/design/${m[1]}/${m[2]}`;
    return { kind: "canva", link: `${base}/view`, embed: `${base}/view?embed` };
  }
  return null;
}
