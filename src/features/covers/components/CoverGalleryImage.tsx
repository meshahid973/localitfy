import { memo, useEffect, useState } from "react";

const CoverGalleryImage = memo(function CoverGalleryImage({ src, label, priority = false }: { src: string; label: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  const fallback = String(label || "cover").trim().slice(0, 1).toUpperCase() || "♪";
  useEffect(() => setFailed(false), [src]);
  return <span className={`coverGalleryImageShellCleanOnly isLoaded ${failed ? "isFailed" : ""}`}><span className="coverGalleryImagePlaceholderCleanOnly" aria-hidden="true">{fallback}</span>{src && !failed ? <img className="coverGalleryImageCleanOnly isLoaded" src={src} alt="" width={220} height={220} loading={priority ? "eager" : "lazy"} decoding="async" fetchPriority={priority ? "high" : "low"} referrerPolicy="no-referrer" draggable={false} onError={() => setFailed(true)} /> : null}</span>;
});
export default CoverGalleryImage;
