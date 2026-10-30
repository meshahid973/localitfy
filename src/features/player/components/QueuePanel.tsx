import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, SetStateAction } from "react";
import { GripVertical, ListX, Repeat, Repeat1, X } from "lucide-react";
import { Cover } from "../../covers/Cover";
import { prettyMeta, prettyTitle } from "../../search/search.utils";
import { formatTime } from "../../../shared/utils/format";
import type { Song } from "../../library/song.types";
import type { RepeatMode } from "../player.types";
import { buildQueueEntries, moveQueueItem } from "../playbackSource";
import "./queue-panel.css";

/** What repeat-all will play again once the queue runs out: listed songs, or a hint when the order isn't fixed. */
export type QueuePanelRepeatPreview = { label: string; songs: Song[]; hint: string };

export type QueuePanelProps = {
  open: boolean;
  onClose: () => unknown;
  currentSong: Song | null;
  contextLabel: string;
  /** Upcoming song ids; the panel edits them directly (remove, reorder, clear). */
  queue: string[];
  setQueue: Dispatch<SetStateAction<string[]>>;
  songsById: Map<string, Song>;
  /** Shown when nothing is queued: the song normal playback would continue with. */
  autoNextSong: Song | null;
  /** Songs song radio added, labelled in the list. */
  radioSongIds?: ReadonlySet<string>;
  repeatMode: RepeatMode;
  repeatPreview: QueuePanelRepeatPreview | null;
  playQueueItem: (index: number) => unknown;
  selectSong: (songId: string, shouldPlay?: boolean) => unknown;
  openSongContextMenu: (event: ReactMouseEvent<HTMLElement>, song: Song) => unknown;
};

const QUEUE_DRAG_TYPE = "text/localtify-queue-index";
const QUEUE_RENDER_STEP = 150;
const REPEAT_PREVIEW_LIMIT = 50;

export default function QueuePanel({
  open,
  onClose,
  currentSong,
  contextLabel,
  queue,
  setQueue,
  songsById,
  autoNextSong,
  radioSongIds,
  repeatMode,
  repeatPreview,
  playQueueItem,
  selectSong,
  openSongContextMenu
}: QueuePanelProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const [renderLimit, setRenderLimit] = useState(QUEUE_RENDER_STEP);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setRenderLimit(QUEUE_RENDER_STEP);
    panelRef.current?.focus({ preventScroll: true });

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector(".songContextMenuLayer")) return;
      onClose();
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (panelRef.current?.contains(target) || target.closest(".playerQueueButton, .songContextMenuLayer, .modalBackdrop, [role='dialog']")) return;
      onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("pointerdown", closeOnOutsidePointer, true);
    };
  }, [open, onClose]);

  const entries = useMemo(
    () => open ? buildQueueEntries(queue, songsById) : [],
    [open, queue, songsById]
  );
  if (!open) return null;
  const removeQueueItem = (index: number) => setQueue((current) => current.filter((_, itemIndex) => itemIndex !== index));
  const clearQueue = () => setQueue([]);

  function handleDragOver(event: ReactDragEvent<HTMLElement>, index: number) {
    if (!event.dataTransfer.types.includes(QUEUE_DRAG_TYPE)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDropIndex(index);
  }

  function handleDrop(event: ReactDragEvent<HTMLElement>, index: number) {
    const from = Number(event.dataTransfer.getData(QUEUE_DRAG_TYPE));
    setDropIndex(null);
    if (!Number.isInteger(from)) return;
    event.preventDefault();
    event.stopPropagation();
    if (from !== index) setQueue((current) => moveQueueItem(current, from, index));
  }

  return (
    <aside ref={panelRef} className="queuePanel" role="dialog" aria-label="play queue" tabIndex={-1}>
      <header className="queuePanelHead">
        <strong>queue</strong>
        <div className="queuePanelHeadActions">
          {entries.length ? (
            <button type="button" className="queuePanelTextButton" onClick={clearQueue}>
              <ListX size={14} strokeWidth={2.4} aria-hidden="true" />
              <span>clear</span>
            </button>
          ) : null}
          <button type="button" className="queuePanelIconButton" onClick={onClose} aria-label="close queue">
            <X size={16} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="queuePanelBody">
        <section aria-label="now playing">
          <p className="queuePanelLabel">
            now playing{contextLabel ? <small> · {contextLabel}</small> : null}
            {repeatMode === "one" ? (
              <span className="queuePanelRepeatBadge"><Repeat1 size={12} strokeWidth={2.6} aria-hidden="true" /> on repeat</span>
            ) : null}
          </p>
          {currentSong ? (
            <div className="queuePanelRow isCurrent" onContextMenu={(event) => openSongContextMenu(event, currentSong)}>
              <span className="queuePanelRowMain queuePanelRowStatic">
                <Cover song={currentSong} className="queuePanelCover" />
                <span className="queuePanelCopy">
                  <strong>{prettyTitle(currentSong.title, 8)}</strong>
                  <small>{prettyMeta(currentSong.artist)}</small>
                </span>
              </span>
              <span className="queuePanelDuration">{formatTime(currentSong.duration || 0)}</span>
            </div>
          ) : (
            <p className="queuePanelEmpty">nothing playing</p>
          )}
        </section>

        <section aria-label="next in queue">
          <p className="queuePanelLabel">next up{entries.length ? <small> · {entries.length} song{entries.length === 1 ? "" : "s"}</small> : null}</p>
          {entries.length ? (
            <ol className="queuePanelList" onDragLeave={(event) => {
              if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropIndex(null);
            }}>
              {entries.slice(0, renderLimit).map(({ song, index }) => (
                <li
                  key={`${song.id}-${index}`}
                  className={`queuePanelRow ${dropIndex === index ? "isDropTarget" : ""}`}
                  draggable
                  onDragStart={(event) => {
                    event.stopPropagation();
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(QUEUE_DRAG_TYPE, String(index));
                  }}
                  onDragEnd={() => setDropIndex(null)}
                  onDragOver={(event) => handleDragOver(event, index)}
                  onDrop={(event) => handleDrop(event, index)}
                  onContextMenu={(event) => openSongContextMenu(event, song)}
                >
                  <GripVertical className="queuePanelGrip" size={14} strokeWidth={2.2} aria-hidden="true" />
                  <button type="button" className="queuePanelRowMain" onClick={() => playQueueItem(index)} title="play now">
                    <Cover song={song} className="queuePanelCover" />
                    <span className="queuePanelCopy">
                      <strong>{prettyTitle(song.title, 8)}</strong>
                      <small>{radioSongIds?.has(song.id) ? <span className="queuePanelRadioTag">radio · </span> : null}{prettyMeta(song.artist)}</small>
                    </span>
                  </button>
                  <span className="queuePanelDuration">{formatTime(song.duration || 0)}</span>
                  <button type="button" className="queuePanelIconButton" onClick={() => removeQueueItem(index)} aria-label={`remove ${song.title} from queue`} title="remove from queue">
                    <X size={14} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
          ) : autoNextSong ? (
            <>
              <div className="queuePanelRow">
                <button type="button" className="queuePanelRowMain" onClick={() => void selectSong(autoNextSong.id, true)} title="play now">
                  <Cover song={autoNextSong} className="queuePanelCover" />
                  <span className="queuePanelCopy">
                    <strong>{prettyTitle(autoNextSong.title, 8)}</strong>
                    <small>{prettyMeta(autoNextSong.artist)}</small>
                  </span>
                </button>
                <span className="queuePanelDuration">{formatTime(autoNextSong.duration || 0)}</span>
              </div>
            </>
          ) : (
            <p className="queuePanelEmpty">queue is empty</p>
          )}
          {entries.length > renderLimit ? (
            <button type="button" className="queuePanelTextButton queuePanelMore" onClick={() => setRenderLimit((limit) => limit + QUEUE_RENDER_STEP)}>
              show {Math.min(QUEUE_RENDER_STEP, entries.length - renderLimit)} more
            </button>
          ) : null}
        </section>

        {repeatMode === "all" && repeatPreview ? (
          <section className="queuePanelRepeat" aria-label="repeats after the queue">
            <p className="queuePanelLabel">
              <Repeat size={12} strokeWidth={2.6} aria-hidden="true" /> then repeats<small> · {repeatPreview.label}</small>
            </p>
            {repeatPreview.songs.length ? (
              <ol className="queuePanelList">
                {repeatPreview.songs.slice(0, REPEAT_PREVIEW_LIMIT).map((song, index) => (
                  <li key={`${song.id}-${index}`} className="queuePanelRow isRepeatPreview" onContextMenu={(event) => openSongContextMenu(event, song)}>
                    <span className="queuePanelRepeatIndex" aria-hidden="true">{index + 1}</span>
                    <span className="queuePanelRowMain queuePanelRowStatic">
                      <Cover song={song} className="queuePanelCover" />
                      <span className="queuePanelCopy">
                        <strong>{prettyTitle(song.title, 8)}</strong>
                        <small>{prettyMeta(song.artist)}</small>
                      </span>
                    </span>
                    <span className="queuePanelDuration">{formatTime(song.duration || 0)}</span>
                  </li>
                ))}
              </ol>
            ) : null}
            {repeatPreview.songs.length > REPEAT_PREVIEW_LIMIT ? (
              <p className="queuePanelHint">and {repeatPreview.songs.length - REPEAT_PREVIEW_LIMIT} more</p>
            ) : null}
            {repeatPreview.hint ? <p className="queuePanelHint">{repeatPreview.hint}</p> : null}
          </section>
        ) : null}
      </div>
    </aside>
  );
}
