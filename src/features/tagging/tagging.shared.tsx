import { LoaderCircle } from "lucide-react";
import type { TagProposal } from "./tagging.types";

export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
export const errorText = (reason: unknown) => reason instanceof Error ? reason.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : "Something went wrong. Please try again.";

export const Spinner = () => <LoaderCircle size={14} className="taggingSpinner" aria-hidden="true" />;

/** Plain-language summary of what saving this match changes. */
export function describeChanges(proposal: TagProposal) {
  const { tags, current } = proposal;
  const changes = (["title", "artist", "album", "genre"] as const).filter((key) => tags[key] && tags[key] !== current[key])
    .map((key) => !current[key] || (key === "album" && current.album === "local files") ? `adds ${key}` : `${key} was “${current[key]}”`);
  if (proposal.coverUrl) changes.push("adds cover");
  if (!proposal.writable) changes.push("library only (this file type can’t be tagged)");
  return changes.length ? changes.join(" · ") : "adds track number and MusicBrainz IDs";
}

// Matches below this are shown but not ticked, so they need a deliberate choice.
export const AUTO_SELECT = 0.8;

export function ProposalRow({ proposal, checked, onToggle }: { proposal: TagProposal; checked: boolean; onToggle: () => void }) {
  const { tags } = proposal;
  const details = [tags.album + (tags.year ? ` (${tags.year})` : ""), tags.trackNumber ? `track ${tags.trackNumber}${tags.trackTotal ? ` of ${tags.trackTotal}` : ""}` : "", tags.genre].filter(Boolean).join(" · ");
  return <li className={checked ? "taggingProposal" : "taggingProposal unselected"}>
    <label>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      {proposal.coverUrl ? <img src={proposal.coverUrl} alt="" loading="lazy" /> : <span className="taggingNoCover" aria-hidden="true" />}
      <span className="taggingProposalText">
        <strong>{tags.title} <small>{tags.artist}</small></strong>
        <small>{details}</small>
        <small className="taggingChanges">{describeChanges(proposal)}</small>
      </span>
    </label>
    <span className={proposal.confidence >= AUTO_SELECT ? "taggingScore" : "taggingScore low"} title="How closely title, artist and length match">{Math.round(proposal.confidence * 100)}%</span>
  </li>;
}

export const byTrack = (a: TagProposal, b: TagProposal) => a.tags.discNumber - b.tags.discNumber || a.tags.trackNumber - b.tags.trackNumber;
