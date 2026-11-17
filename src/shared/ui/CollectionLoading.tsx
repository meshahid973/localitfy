import "./collection-loading.css";

/** Stable, inexpensive placeholders while a collection is being resolved. */
export function CollectionLoading({ label }: { label: string }) {
  return (
    <div className="collectionLoading" role="status">
      <p>{label}</p>
      <div className="collectionLoadingItems" aria-hidden="true">
        {[0, 1, 2].map((item) => <div className="collectionLoadingItem" key={item}><span /><div><i /><i /></div></div>)}
      </div>
    </div>
  );
}
