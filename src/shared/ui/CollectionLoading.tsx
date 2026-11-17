import "./collection-loading.css";

/** Stable, inexpensive placeholders while a collection is being resolved. */
export function CollectionLoading({ label, announce = true }: { label: string; announce?: boolean }) {
  return (
    <div className="collectionLoading" role={announce ? "status" : undefined}>
      <p>{label}</p>
      <div className="collectionLoadingItems" aria-hidden="true">
        {[0, 1, 2].map((item) => <div className="collectionLoadingItem" key={item}><span /><div><i /><i /></div></div>)}
      </div>
    </div>
  );
}
