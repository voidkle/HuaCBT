/** Serves a file, honoring a single `Range: bytes=a-b` so media players and pdf.js can fetch only what they need. */
export function serveFile(file: Bun.BunFile, rangeHeader: string | null, headers: Record<string, string>) {
  const size = file.size;
  const base = { "accept-ranges": "bytes", ...headers };
  const m = rangeHeader && /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!m || (m[1] === "" && m[2] === "")) return new Response(file, { headers: { ...base, "content-length": String(size) } });
  const start = m[1] === "" ? Math.max(0, size - Number(m[2])) : Number(m[1]);
  const end = m[1] === "" || m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { ...base, "content-range": `bytes */${size}` } });
  return new Response(file.slice(start, end + 1), {
    status: 206,
    headers: { ...base, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
  });
}
