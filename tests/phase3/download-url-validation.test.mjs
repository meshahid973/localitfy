import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { normalizeYouTubeUrl } = require(path.join(root, "electron", "downloader.cjs"));
const canonical = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

test("normalizes supported YouTube video links without playlist parameters", () => {
  assert.equal(normalizeYouTubeUrl("https://youtu.be/dQw4w9WgXcQ?t=45"), canonical);
  assert.equal(normalizeYouTubeUrl("https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=ABC"), canonical);
  assert.equal(normalizeYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), canonical);
  assert.equal(normalizeYouTubeUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ"), canonical);
});

test("rejects impersonated domains and option injection before invoking yt-dlp", () => {
  for (const raw of [
    "--exec=https://youtu.be/dQw4w9WgXcQ",
    "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
    "https://evil.test/youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be.evil.test/dQw4w9WgXcQ",
    "https://user:secret@youtube.com/watch?v=dQw4w9WgXcQ",
    "http://youtube.com/watch?v=dQw4w9WgXcQ",
    "file:///youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com:8443/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=not-a-valid-id",
    "https://www.youtube.com/playlist?list=ABC"
  ]) {
    assert.equal(normalizeYouTubeUrl(raw), "", raw);
  }
});
