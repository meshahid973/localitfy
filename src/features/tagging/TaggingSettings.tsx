import { useEffect, useState } from "react";
import { Check, RefreshCw, Search } from "lucide-react";
import { ToggleRow } from "../settings/settings.shared";
import type { Settings } from "../settings/settings.types";
import type { Song } from "../library/song.types";
import type { TagAlbumGroup, TagAudit, TagLookupResult } from "./tagging.types";
import { AUTO_SELECT, ProposalRow, Spinner, byTrack, errorText, plural } from "./tagging.shared";
import "./tagging.css";

type TaggingSettingsProps = {
  settings: Pick<Settings, "musicbrainzTagging" | "musicbrainzWriteFiles">;
  songs: readonly Song[];
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => unknown;
};

const groupName = (group: TagAlbumGroup) => group.album ? `${group.album} · ${group.artist}` : `${group.artist} · singles`;
/** Looks songs up on MusicBrainz, shows the proposed tags and writes the accepted ones. */
export default function TaggingSettings({ settings, songs, updateSetting }: TaggingSettingsProps) {
  const enabled = settings.musicbrainzTagging === true;
  const [audit, setAudit] = useState<TagAudit | null>(null);
  const [results, setResults] = useState<Record<string, TagLookupResult>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  // The group being looked up now, and the ones still waiting in a "look up all" run.
  const [activeKey, setActiveKey] = useState("");
  const [queued, setQueued] = useState<Set<string>>(new Set());
  // Lookups keep running when the panel closes; bring back what finished and the audit it belongs to.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    // Started inside a promise so a failing bridge call is caught instead of crashing the page.
    void Promise.resolve().then(() => window.localitfy.getPendingMusicBrainzTags()).then(async (pending) => {
      if (cancelled || !pending.length) return;
      const restored: Record<string, TagLookupResult> = {};
      for (const proposal of pending) (restored[proposal.groupKey] ||= { proposals: [], missed: [] }).proposals.push(proposal);
      setResults((current) => ({ ...restored, ...current }));
      setSelected((current) => new Set([...current, ...pending.filter((proposal) => proposal.confidence >= AUTO_SELECT).map((proposal) => proposal.songId)]));
      const next = await window.localitfy.auditMusicBrainzTags();
      if (!cancelled) setAudit((current) => current || next);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [enabled]);

  const titleOf = (id: string) => songs.find((song) => song.id === id)?.title || "Unknown song";

  async function checkLibrary() {
    setBusy("audit"); setMessage("");
    try {
      const next = await window.localitfy.auditMusicBrainzTags();
      setAudit(next);
      if (!next.untaggedCount) setMessage("Every song has MusicBrainz IDs.");
    } catch (reason) { setMessage(errorText(reason)); } finally { setBusy(""); }
  }

  async function lookUp(groups: TagAlbumGroup[], idsOf: (group: TagAlbumGroup) => string[]) {
    setMessage("");
    setQueued(new Set(groups.map((group) => group.key)));
    try {
      for (const [index, group] of groups.entries()) {
        setActiveKey(group.key);
        setBusy(groups.length > 1 ? `Looking up ${index + 1} of ${groups.length}: ${groupName(group)}` : `Looking up ${groupName(group)}`);
        const result = await window.localitfy.lookUpMusicBrainzTags(idsOf(group));
        setResults((current) => ({ ...current, [group.key]: result }));
        setSelected((current) => new Set([...current, ...result.proposals.filter((proposal) => proposal.confidence >= AUTO_SELECT).map((proposal) => proposal.songId)]));
        setQueued((current) => { const next = new Set(current); next.delete(group.key); return next; });
      }
      if (groups.length > 1) setMessage("Lookup finished. Check the matches, then save the ones you want.");
    } catch (reason) { setMessage(errorText(reason)); } finally { setBusy(""); setActiveKey(""); setQueued(new Set()); }
  }

  async function apply() {
    const ids = [...selected];
    setBusy(`Saving tags for ${plural(ids.length, "song")}…`); setMessage("");
    try {
      const result = await window.localitfy.applyMusicBrainzTags(ids);
      const failed = new Set(result.failed.map((failure) => failure.songId));
      const done = new Set(ids.filter((id) => !failed.has(id)));
      setResults((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, { ...value, proposals: value.proposals.filter((proposal) => !done.has(proposal.songId)) }])));
      setSelected(failed);
      const parts = [`Updated ${plural(result.applied, "song")}${result.written ? `, wrote tags into ${plural(result.written, "file")} (originals are in the Trash)` : ""}.`];
      if (result.failed.length) parts.push(`Could not update: ${result.failed.map((failure) => `${failure.title} (${failure.error})`).join(", ")}.`);
      setMessage(parts.join(" "));
      setAudit(await window.localitfy.auditMusicBrainzTags());
    } catch (reason) { setMessage(errorText(reason)); } finally { setBusy(""); }
  }

  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const setGroupSelected = (ids: string[], on: boolean) => setSelected((current) => { const next = new Set(current); ids.forEach((id) => on ? next.add(id) : next.delete(id)); return next; });
  const disabled = Boolean(busy) || !enabled;
  const groupBlock = (group: TagAlbumGroup, ids: string[], detail: string) => {
    const result = results[group.key];
    const proposals = result ? (group.album ? [...result.proposals].sort(byTrack) : result.proposals) : [];
    const proposalIds = proposals.map((proposal) => proposal.songId);
    const allSelected = proposalIds.length > 0 && proposalIds.every((id) => selected.has(id));
    const state = activeKey === group.key ? <span className="taggingGroupState"><Spinner /> Looking up…</span>
      : queued.has(group.key) ? <span className="taggingGroupState">Waiting…</span>
      : <span className="taggingGroupActions">
        {proposalIds.length > 1 ? <button type="button" className="settingsTinyButton" disabled={Boolean(busy)} onClick={() => setGroupSelected(proposalIds, !allSelected)}>{allSelected ? "Select none" : "Select all"}</button> : null}
        <button type="button" className="settingsTinyButton" disabled={disabled} onClick={() => void lookUp([group], () => ids)}>{result ? "Look up again" : "Look up"}</button>
      </span>;
    return <li key={group.key} className={activeKey === group.key ? "taggingGroup active" : "taggingGroup"}>
      <div className="taggingGroupHeader">
        <span><strong title={group.folder}>{groupName(group)}</strong><small>{detail}</small></span>
        {state}
      </div>
      {result ? <ul className="taggingProposals">
        {proposals.map((proposal) => <ProposalRow key={proposal.songId} proposal={proposal} checked={selected.has(proposal.songId)} onToggle={() => toggle(proposal.songId)} />)}
        {result.missed.map((id) => <li key={id} className="taggingMissed">No match found for {titleOf(id)}</li>)}
        {!proposals.length && !result.missed.length ? <li className="taggingMissed">All saved.</li> : null}
      </ul> : null}
    </li>;
  };

  return <div className="settingsPanelCard settingsFocusPanelV491">
    <div className="settingsPanelHeader"><div><strong>MusicBrainz tagging</strong><span>Looks songs up on MusicBrainz, the open music database, and fills in title, artist, album, genre, track numbers and cover art. You review every change before anything is saved. Lookups send each song’s title, artist, album and length to musicbrainz.org; covers come from the Cover Art Archive and are saved on this device.</span></div></div>
    <fieldset className="experimentalControls">
      <ToggleRow label="Use MusicBrainz tagging" help="Off by default. Only looks songs up when you ask it to." checked={enabled} onChange={(value) => void updateSetting("musicbrainzTagging", value)} />
      <ToggleRow label="Write tags into music files" help="MP3 and FLAC files get the new tags and cover without re-encoding the audio. The original file goes to the Trash first. When off, only your library is updated." checked={settings.musicbrainzWriteFiles !== false} onChange={(value) => void updateSetting("musicbrainzWriteFiles", value)} />
    </fieldset>
    <div className="settingsActionRow settingsActionRowCleanV491">
      <button type="button" className="settingsActionButton" disabled={disabled} onClick={() => void checkLibrary()}>{busy === "audit" ? <Spinner /> : <RefreshCw size={14} />} {busy === "audit" ? "Checking tags…" : "Find untagged songs"}</button>
      {audit?.untagged.length ? <button type="button" className="settingsActionButton" disabled={disabled} onClick={() => void lookUp(audit.untagged, (group) => group.untaggedIds)}><Search size={14} /> Look up all untagged</button> : null}
      {selected.size ? <button type="button" className="settingsActionButton settingsPrimaryAction" disabled={disabled} onClick={() => void apply()}><Check size={14} /> Save tags for {plural(selected.size, "song")}</button> : null}
    </div>
    {busy || message ? <p className={busy ? "taggingStatus working" : "taggingStatus"} role="status" aria-live="polite">{busy ? <Spinner /> : null}{busy === "audit" ? "Reading tags from your music files…" : busy || message}</p> : null}
    {audit ? <div className="taggingAudit">
      <p>{audit.tagged} of {plural(audit.total, "song")} have MusicBrainz IDs{audit.missing ? ` · ${audit.missing} files missing` : ""}.</p>
      {audit.untagged.length ? <>
        <strong>{plural(audit.untaggedCount, "song")} without MusicBrainz IDs</strong>
        <ul className="taggingGroups" aria-label="Songs without MusicBrainz IDs">{audit.untagged.map((group) => groupBlock(group, group.untaggedIds, group.untaggedIds.length === group.songIds.length ? plural(group.songIds.length, "song") : `${group.untaggedIds.length} of ${group.songIds.length} songs`))}</ul>
      </> : null}
      {audit.splitAlbums.length ? <details className="taggingSplitAlbums">
        <summary>{plural(audit.splitAlbums.length, "album")} tagged track by track</summary>
        <p className="settingsHintText">Every song has IDs, but they point at different releases of the album (for example a deluxe edition and a single). Looking the album up matches all of it to one release.</p>
        <ul className="taggingGroups">{audit.splitAlbums.map((group) => groupBlock(group, group.songIds, `${plural(group.songIds.length, "song")} across ${group.releaseCount} releases`))}</ul>
      </details> : null}
    </div> : null}
  </div>;
}
