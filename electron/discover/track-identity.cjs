"use strict";
// Preserve the selected catalog identity through the existing metadata-download journal.
const selectedYouTubeId = value => /^ytmusic-([A-Za-z0-9_-]{11})$/.exec(String(value || ""))?.[1] || "";
const selectedYouTubeUrl = value => {
  const id = selectedYouTubeId(value);
  return id ? "https://www.youtube.com/watch?v=" + id : "";
};
const validTrackIdentity = value => /^[a-zA-Z0-9]{1,64}$/.test(String(value || "")) || /^lastfm-[a-z0-9]{1,7}$/.test(String(value || "")) || Boolean(selectedYouTubeId(value));
module.exports = { selectedYouTubeId, selectedYouTubeUrl, validTrackIdentity };
