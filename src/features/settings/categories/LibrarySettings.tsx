import type { ChoiceOption, SongLike, UpdateSetting } from "../settings.shared";
import type { Settings } from "../settings.types";

export type LibrarySettingsProps = {
  settings: Settings;
  updateSetting: UpdateSetting;
  songs: ReadonlyArray<SongLike>;
  libraryScanBusy: boolean;
  cleanLibraryMetadataAction: () => void;
  cleanSelectedMetadataAction?: () => void;
  metadataSelectedCount: number;
  metadataCleanPreview?: { changedCount?: number; skippedCount?: number; titleFixCount?: number; artistFixCount?: number; albumFixCount?: number; items?: Array<{ id: string; before?: {title?:string;artist?:string}; after?: {title?:string;artist?:string} }> } | null;
  applyMetadataCleanPreviewAction?: () => void | Promise<void>;
  cancelMetadataCleanPreviewAction?: () => void;
  undoLastMetadataCleanAction?: () => void | Promise<void>;
  metadataUndoCount: number;
  rebuildSearchIndexAction: () => void;
  libraryScanMessage: string;
  cleanupOptions: ReadonlyArray<ChoiceOption>;
};
export default function LibrarySettings(p: LibrarySettingsProps) {
  const preview = p.metadataCleanPreview;
  return <section className="settingsCategoryPage" aria-label="Library settings"><div className="settingsCategoryHeader"><div><p className="eyebrow">library</p><h4>imports, search, and metadata</h4></div><span>{p.songs.length} songs indexed</span></div><div className="settingsPanelCard metadataCleanerPanelV441"><div className="settingsPanelHeader metadataCleanerHeaderV440"><div><strong>Clean title tool</strong><span>Preview title cleanup before changing saved library text.</span></div><span className="metadataCleanerBadgeV440">{p.libraryScanBusy ? "working" : "preview first"}</span></div><div className="metadataCleanerModeGridV441">{p.cleanupOptions.map((option) => <button key={option.id} className={`cleanerOptionV440 ${p.settings.discordTitleCleanup === option.id ? "active" : ""}`} type="button" onClick={() => void p.updateSetting("discordTitleCleanup", option.id)}><strong>{option.name}</strong><small>{option.note}</small></button>)}</div><div className="settingsActionRow metadataCleanerActionRowV440"><button className="settingsActionButton settingsPrimaryAction" type="button" disabled={p.libraryScanBusy} onClick={p.cleanLibraryMetadataAction}>preview all fixes</button><button className="settingsActionButton" type="button" disabled={p.libraryScanBusy || !p.metadataSelectedCount} onClick={() => p.cleanSelectedMetadataAction?.()}>preview selected {p.metadataSelectedCount ? `(${p.metadataSelectedCount})` : ""}</button><button className="settingsActionButton" type="button" disabled={p.libraryScanBusy || !p.metadataUndoCount} onClick={() => void p.undoLastMetadataCleanAction?.()}>undo last clean {p.metadataUndoCount ? `(${p.metadataUndoCount})` : ""}</button><button className="settingsActionButton settingsGhostAction" type="button" disabled={p.libraryScanBusy} onClick={p.rebuildSearchIndexAction}>rebuild search</button></div>
    {preview ? <div className="metadataCleanerPreviewBoxV425 metadataCleanerPreviewBoxV440" role="status" aria-live="polite"><div className="metadataCleanerPreviewHeadV425 metadataCleanerPreviewHeadV440"><span>preview before applying</span><strong>{preview.changedCount || 0} fix{(preview.changedCount || 0) === 1 ? "" : "es"} ready</strong><small>{preview.skippedCount || 0} skipped · {preview.titleFixCount || 0} titles · {preview.artistFixCount || 0} artists · {preview.albumFixCount || 0} albums</small></div><div className="metadataCleanerPreviewListV425 metadataCleanerPreviewListV440">{(preview.items || []).slice(0, 6).map((item) => <div className="metadataCleanerPreviewItemV425 metadataCleanerPreviewItemV440" key={item.id}><span><small>before</small><strong>{item.before?.title || "untitled"}</strong><em>{item.before?.artist || "unknown artist"}</em></span><b className="metadataCleanerArrowV440" aria-hidden="true"><i /></b><span><small>after</small><strong>{item.after?.title || "untitled"}</strong><em>{item.after?.artist || "unknown artist"}</em></span></div>)}</div><div className="metadataCleanerPreviewActionsV425 metadataCleanerPreviewActionsV440"><button className="settingsActionButton settingsPrimaryAction" type="button" disabled={p.libraryScanBusy || !(preview.changedCount || 0)} onClick={() => void p.applyMetadataCleanPreviewAction?.()}>apply preview</button><button className="settingsActionButton settingsGhostAction" type="button" disabled={p.libraryScanBusy} onClick={() => p.cancelMetadataCleanPreviewAction?.()}>cancel</button></div></div> : null}
    {p.libraryScanMessage ? <p className="settingsHintText">{p.libraryScanMessage}</p> : null}</div></section>;
}
