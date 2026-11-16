import { expect, test } from "bun:test";
import { parseSlideLink } from "./links";

test("Google Slides: file ids and published links become embeds, rebuilt from the id", () => {
  const a = parseSlideLink("https://docs.google.com/presentation/d/1AbCdEfGhIjKlMn_-op/edit?usp=sharing#slide=id.p");
  expect(a).toEqual({ kind: "google", link: "https://docs.google.com/presentation/d/1AbCdEfGhIjKlMn_-op/view", embed: "https://docs.google.com/presentation/d/1AbCdEfGhIjKlMn_-op/embed?start=false&loop=false&delayms=3000" });
  const b = parseSlideLink("https://docs.google.com/presentation/d/e/2PACX-1vAbCdEfGh123/pub?start=true");
  expect(b?.embed).toBe("https://docs.google.com/presentation/d/e/2PACX-1vAbCdEfGh123/embed?start=false&loop=false&delayms=3000");
});

test("Canva: view/watch links become ?embed", () => {
  const c = parseSlideLink("https://www.canva.com/design/DAFabc12345/Xy_Z-token123/view?utm_content=x");
  expect(c).toEqual({ kind: "canva", link: "https://www.canva.com/design/DAFabc12345/Xy_Z-token123/view", embed: "https://www.canva.com/design/DAFabc12345/Xy_Z-token123/view?embed" });
  expect(parseSlideLink("https://canva.com/design/DAFabc12345/Xy_Z-token123/watch")?.kind).toBe("canva");
});

test("everything else is refused", () => {
  for (const bad of [
    "http://docs.google.com/presentation/d/1AbCdEfGhIjKl/edit", // not https
    "https://docs.google.com.evil.com/presentation/d/1AbCdEfGhIjKl/edit",
    "https://evil.com/?u=https://docs.google.com/presentation/d/1AbCdEfGhIjKl/edit",
    "https://user:pw@docs.google.com/presentation/d/1AbCdEfGhIjKl/edit",
    "https://docs.google.com:8443/presentation/d/1AbCdEfGhIjKl/edit",
    "https://docs.google.com/document/d/1AbCdEfGhIjKl/edit", // a doc, not slides
    "https://docs.google.com/presentation/d/short/edit",
    "https://canva.link/abc123",
    "https://www.canva.com/design/DAFabc12345/Xy_Z-token123/edit", // edit link would show an editor
    "javascript:alert(1)",
    "not a url",
    "",
  ]) expect({ bad, r: parseSlideLink(bad) }).toEqual({ bad, r: null });
});
