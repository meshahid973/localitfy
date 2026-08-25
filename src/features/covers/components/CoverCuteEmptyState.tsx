const EMPTY_STATE_IMAGE_SRC = new URL("../../../assets/empty-state.png", import.meta.url).href;
export default function CoverCuteEmptyState() {
  return <div className="emptyState coverEmptyState coverEmptyStateClean coverEmptyStateCuteV466 coverEmptyStateNoBoxV467"><span className="coverEmptyImageShellV466" aria-hidden="true"><img src={EMPTY_STATE_IMAGE_SRC} alt="" draggable={false} /></span><p className="coverEmptyCaptionV467">my team couldn't find anything here!!</p></div>;
}
