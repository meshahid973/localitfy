import { useEffect } from "react";
import { X } from "lucide-react";
import { useModalFocus } from "../../shared/hooks/useModalFocus";
import { APP_VERSION, whatsNewItems } from "./update.constants";

export type WhatsNewModalProps = { open: boolean; onClose: () => void };

export default function WhatsNewModal({ open, onClose }: WhatsNewModalProps) {
  const dialogRef = useModalFocus<HTMLElement>(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const topmost = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).at(-1);
      if (topmost !== dialogRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dialogRef, onClose, open]);

  if (!open) return null;
  return (
    <div className="whatsNewOverlay" onClick={onClose}>
      <section ref={dialogRef} tabIndex={-1} className="whatsNewCard" role="dialog" aria-modal="true" aria-labelledby="whatsNewTitle" onClick={(event) => event.stopPropagation()}>
        <button className="whatsNewClose" type="button" onClick={onClose} aria-label="Close what's new"><X size={18} strokeWidth={2.4} /></button>
        <p className="eyebrow">what's new</p>
        <h3 id="whatsNewTitle">localtify {APP_VERSION}</h3>
        <p className="whatsNewSubtext">A maintenance-focused release with library, playback, and UI improvements, plus safer packaging for future updates.</p>
        <ul>{whatsNewItems.map((item) => <li key={item}>{item}</li>)}</ul>
        <button className="heroMain" type="button" onClick={onClose}>got it</button>
      </section>
    </div>
  );
}
