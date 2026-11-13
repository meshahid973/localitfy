const EMPTY_STATE_IMAGE_SRC = new URL("../../../assets/empty-state.png", import.meta.url).href;

type CoverCuteEmptyStateProps = {
  title: string;
  message: string;
};

export default function CoverCuteEmptyState({ title, message }: CoverCuteEmptyStateProps) {
  return (
    <div className="emptyState coverEmptyState coverEmptyStateClean coverEmptyStateCuteV466 coverEmptyStateNoBoxV467" role="status">
      <span className="coverEmptyImageShellV466" aria-hidden="true">
        <img src={EMPTY_STATE_IMAGE_SRC} alt="" loading="lazy" decoding="async" draggable={false} />
      </span>
      <div className="coverEmptyCopyV500">
        <strong className="coverEmptyCaptionV467">{title}</strong>
        <p className="coverEmptyDetailV500">{message}</p>
      </div>
    </div>
  );
}
