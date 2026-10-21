// LRC parsing and lookup-text cleanup for lyrics. Pure functions so tests can run without Electron.

const TIME_TAG = /^\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/;
const WORD_TAG = /<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g;
const MAX_LINES = 2000;

function parseLrc(source) {
  const text = String(source || "").replace(/^﻿/, "");
  let offset = 0;
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const offsetTag = /^\s*\[offset:\s*([+-]?\d+)\s*\]/i.exec(raw);
    if (offsetTag) { offset = Number(offsetTag[1]) / 1000; continue; }
    const times = [];
    let rest = raw.trim();
    let match;
    // Timestamps lead the line; one line may repeat at several times.
    while ((match = TIME_TAG.exec(rest))) {
      const fraction = match[3] ? Number(match[3]) / 10 ** match[3].length : 0;
      times.push(Number(match[1]) * 60 + Number(match[2]) + fraction);
      rest = rest.slice(match[0].length);
    }
    if (!times.length) continue;
    const words = rest.replace(WORD_TAG, "").replace(/\s+/g, " ").trim();
    for (const time of times) lines.push({ time: Math.max(0, time - offset), text: words });
    if (lines.length >= MAX_LINES) break;
  }
  lines.sort((a, b) => a.time - b.time);
  // Drop leading blank lines; keep inner blanks as instrumental breaks.
  while (lines.length && !lines[0].text) lines.shift();
  return lines;
}

function plainLines(source) {
  return String(source || "").replace(/^﻿/, "").split(/\r?\n/).map((line) => line.trim()).slice(0, MAX_LINES)
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
