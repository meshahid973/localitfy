// LRC parsing and lookup-text cleanup for lyrics. Pure functions so tests can run without Electron.

const TIME_TAG = /^\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/;
const WORD_TAG = /<(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?>/g;
const MAX_LINES = 2000;
const MAX_SOURCE = 512 * 1024;

function seconds(match) {
  return Number(match[1]) * 60 + Number(match[2]) + (match[3] ? Number(match[3]) / 10 ** match[3].length : 0);
}

// Enhanced LRC timestamps mark the start of a segment; do not synthesize timings.
function timedSegments(rest, lineStart, shift) {
  const tags = [...rest.matchAll(WORD_TAG)];
  if (!tags.length || rest.slice(0, tags[0].index).trim()) return null;
  const segments = [];
  let last = lineStart;
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    const time = seconds(tag);
    if (time < last) return null;
    last = time;
    const content = rest.slice(tag.index + tag[0].length, tags[i + 1]?.index ?? rest.length);
    if (content) segments.push({ time: Math.max(0, time - shift), text: content });
  }
  return segments.length && segments.some(segment => segment.text.trim()) ? segments : null;
}

function parseLrc(source) {
  const text = String(source || "").slice(0, MAX_SOURCE).replace(/^\uFEFF/, "");
  // LRC metadata is global, even if the offset tag is at the bottom of the file.
  const offsetTag = /^\s*\[offset:\s*([+-]?\d+)\s*\]/im.exec(text);
  const offset = offsetTag ? Math.max(-300, Math.min(300, Number(offsetTag[1]) / 1000)) : 0;
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const times = [];
    let rest = raw.trim();
    let match;
    while ((match = TIME_TAG.exec(rest))) {
      times.push(seconds(match));
      rest = rest.slice(match[0].length);
      if (times.length >= MAX_LINES) break;
    }
    if (!times.length) continue;
    const words = rest.replace(WORD_TAG, "").replace(/\s+/g, " ").trim();
    // Repeated line tags are ambiguous for word timings: retain line-level sync.
    const segments = times.length === 1 ? timedSegments(rest, times[0], offset) : null;
    for (const time of times) {
      if (lines.length >= MAX_LINES) break;
      lines.push({ time: Math.max(0, time - offset), text: words, ...(segments ? { words: segments } : {}) });
    }
    if (lines.length >= MAX_LINES) break;
  }
  lines.sort((a, b) => a.time - b.time);
  while (lines.length && !lines[0].text) lines.shift();
  // Reject impossible word times crossing into the next distinct lyric line.
  for (let i = 0; i < lines.length; i++) {
    const next = lines[i + 1]?.time ?? Infinity;
    if (lines[i].words?.some(word => word.time >= next)) delete lines[i].words;
  }
  return lines;
}

function plainLines(source) {
  return String(source || "").slice(0, MAX_SOURCE).replace(/^﻿/, "").split(/\r?\n/).map((line) => line.trim()).slice(0, MAX_LINES)
    .filter((line, index, all) => line || (index > 0 && all[index - 1]));
}

const NOISE = /\s*[([](?:official|lyrics?|lyric video|audio|video|visuali[sz]er|hd|hq|4k|remaster(?:ed)?|explicit|clean|mv|m\/v|slowed|sped\s*up|nightcore|daycore|reverb)[^)\]]*[)\]]/gi;
const EDIT_SUFFIX = /\s*(?:[-–—|]\s*)?(?:slowed(?:\s*(?:\+|\/|and|&)\s*reverb)?|sped\s*up|nightcore|daycore|reverb|extended\s+(?:version|edit)|speed\s*up)(?:\s*\/\s*reverb)?\s*$/i;

function cleanTitle(title) {
  return String(title || "")
    .replace(NOISE, "")
    .replace(/\s*[([](?:feat|ft|with)\.?\s[^)\]]*[)\]]/gi, "")
    .replace(/\s+(?:feat|ft)\.?\s.*$/i, "")
    .replace(/\.(?:mp3|m4a|flac|wav|ogg|opus|aac)$/i, "")
    .replace(EDIT_SUFFIX, "")
    .replace(/\s+/g, " ")
    .trim();
}

function primaryArtist(artist) {
  return String(artist || "")
    .split(/\s*(?:,|;|&| x | and |\bfeat\.?|\bft\.?|\bwith\b)\s*/i)[0]
    .replace(/\s*-\s*topic$/i, "")
    .trim();
}

module.exports = { parseLrc, plainLines, cleanTitle, primaryArtist };
