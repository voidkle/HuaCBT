import { expect, test } from "bun:test";
import { parseCaptions, toPromptLines, toVtt } from "./captions";

test("parses WebVTT: header, ids, settings, tags, optional hours", () => {
  const r = parseCaptions(`WEBVTT - judul\n\nNOTE komentar\n\n1\n00:00:01.000 --> 00:00:03.500 align:start position:0%\nHalo <c.warna>semua</c>\n\n00:05.000 --> 00:07.250\nBaris pertama\nbaris kedua\n`);
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.cues).toEqual([
    { startMs: 1000, endMs: 3500, text: "Halo semua" },
    { startMs: 5000, endMs: 7250, text: "Baris pertama baris kedua" },
  ]);
});

test("parses SRT with comma decimals, BOM and CRLF", () => {
  const r = parseCaptions("﻿1\r\n00:00:00,500 --> 00:00:02,000\r\nSelamat datang\r\n\r\n2\r\n01:02:03,004 --> 01:02:05,000\r\n{\\an8}Jam pertama &amp; kedua\r\n");
  expect(r.ok && r.cues).toEqual([
    { startMs: 500, endMs: 2000, text: "Selamat datang" },
    { startMs: 3_723_004, endMs: 3_725_000, text: "Jam pertama & kedua" },
  ]);
});

test("sorts out-of-order cues and skips broken ones", () => {
  const r = parseCaptions("WEBVTT\n\n00:10.000 --> 00:12.000\nkedua\n\n00:01.000 --> 00:02.000\npertama\n\n00:05.000 --> 00:04.000\nakhir sebelum awal\n\n00:06.000 --> 00:07.000\n<i></i>\n\nbukan cue\n");
  expect(r.ok && r.cues.map((c) => c.text)).toEqual(["pertama", "kedua"]);
});

test("rejects input without usable cues", () => {
  for (const bad of ["", "halo dunia", "WEBVTT\n\nNOTE saja", "1\n00:00:01,000 --> nonsense\nteks"]) expect(parseCaptions(bad).ok).toBe(false);
});

test("pads milliseconds and short fractions", () => {
  const r = parseCaptions("WEBVTT\n\n00:00:01.5 --> 00:00:02.25\nx");
  expect(r.ok && r.cues[0]).toEqual({ startMs: 1500, endMs: 2250, text: "x" });
});

test("toVtt round-trips and escapes markup", () => {
  const cues = [{ startMs: 1000, endMs: 2500, text: "a < b & c" }, { startMs: 3_661_001, endMs: 3_662_000, text: "jam" }];
  const vtt = toVtt(cues);
  expect(vtt.startsWith("WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.500\na &lt; b &amp; c")).toBe(true);
  expect(vtt).toContain("01:01:01.001 --> 01:01:02.000");
  const back = parseCaptions(vtt);
  expect(back.ok && back.cues).toEqual([{ startMs: 1000, endMs: 2500, text: "a < b & c" }, cues[1]!]);
});

test("prompt lines are mm:ss stamped", () => {
  expect(toPromptLines([{ startMs: 65_000, endMs: 66_000, text: "halo" }])).toBe("[01:05] halo");
});
