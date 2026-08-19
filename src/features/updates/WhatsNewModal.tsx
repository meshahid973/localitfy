import { X } from "lucide-react";
import { APP_VERSION, whatsNewItems } from "./update.constants";

export type WhatsNewModalProps = { open: boolean; onClose: () => void };

export default function WhatsNewModal({ open, onClose }: WhatsNewModalProps) {
  if (!open) return null;
  return (
    <div className="whatsNewOverlay" onClick={onClose}>
      <section className="whatsNewCard" role="dialog" aria-modal="true" aria-labelledby="whatsNewTitle" onClick={(event) => event.stopPropagation()}>
        <button className="whatsNewClose" type="button" onClick={onClose} aria-label="Close what's new"><X size={18} strokeWidth={2.4} /></button>
        <p className="eyebrow">what's new</p>
        <h3 id="whatsNewTitle">localtify {APP_VERSION}</h3>
        <p className="whatsNewSubtext">0.4.1 is a fast hotfix focused on the album importer freeze, nested-folder scanning, cover accuracy, and keeping the app responsive after the 0.4.0 release.</p>
        <ul>{whatsNewItems.map((item) => <li key={item}>{item}</li>)}</ul>
        <button className="heroMain" type="button" onClick={onClose}>got it</button>
      </section>
    </div>
  );
}
