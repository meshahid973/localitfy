import { Send, X } from "lucide-react";
import type { FeedbackCategoryId, FeedbackStatus } from "./useFeedbackController";
import { FEEDBACK_CATEGORY_OPTIONS, FEEDBACK_MESSAGE_MAX_LENGTH, FEEDBACK_PROMPT_COPY } from "./feedbackPrompt";
import { localtifyLogo } from "../../core/app.constants";
import "./feedback-prompt.css";

type Props = {
  reducedMotion: boolean;
  feedbackCategory: FeedbackCategoryId;
  setFeedbackCategory: (category: FeedbackCategoryId) => void;
  feedbackMessage: string;
  setFeedbackMessage: (message: string) => void;
  feedbackStatus: FeedbackStatus;
  setFeedbackStatus: (status: FeedbackStatus) => void;
  feedbackSendBusy: boolean;
  closeFeedbackPrompt: () => void;
  submitFeedbackPrompt: () => Promise<void>;
};
export default function FeedbackPromptModal({reducedMotion, feedbackCategory, setFeedbackCategory, feedbackMessage, setFeedbackMessage, feedbackStatus, setFeedbackStatus, feedbackSendBusy, closeFeedbackPrompt, submitFeedbackPrompt}: Props) {
    const remaining = FEEDBACK_MESSAGE_MAX_LENGTH - feedbackMessage.length;
    const feedbackReady = feedbackMessage.trim().length >= 4;

    return (
      <div
          className="feedbackPromptOverlayV331" data-reduced-motion={reducedMotion ? "on" : "off"}
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedbackPromptTitleV329"
        >
          <div
            className={`feedbackPromptCardV331 ${feedbackStatus.kind === "success" ? "feedbackSentV337" : ""} ${feedbackSendBusy ? "feedbackSendingV337" : ""}`}
          >
            <div className="feedbackPromptTopV331">
              <div className="feedbackPromptBrandV331">
                <span className="feedbackPromptLogoV331" aria-hidden="true">
                  <img src={localtifyLogo} alt="" />
                </span>
                <span>
                  <em>localtify feedback</em>
                  <strong>bug reports + suggestions</strong>
                </span>
              </div>

              <button
                type="button"
                className="feedbackPromptCloseV331"
                onClick={() => closeFeedbackPrompt()}
                aria-label="Close feedback popup"
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>

            <div className="feedbackPromptCopyV331">
              <span className="feedbackPromptBadgeV331">quick check-in</span>
              <h2 id="feedbackPromptTitleV329">{FEEDBACK_PROMPT_COPY.title}</h2>
              <p>{FEEDBACK_PROMPT_COPY.body}</p>
              <p>{FEEDBACK_PROMPT_COPY.footer}</p>
            </div>

            <div className="feedbackCategoryRowV331" role="group" aria-label="Feedback type">
              {FEEDBACK_CATEGORY_OPTIONS.map((option) => {
                const active = feedbackCategory === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`feedbackCategoryButtonV331 ${active ? "active" : ""}`}
                    onClick={() => {
                      setFeedbackCategory(option.id);
                      if (feedbackStatus.kind !== "idle") setFeedbackStatus({ kind: "idle", message: "" });
                    }}
                    aria-pressed={active}
                  >
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>

            <label className={`feedbackTextareaWrapV331 ${feedbackMessage.trim().length > 0 ? "isTyping" : ""} ${feedbackReady ? "isReady" : ""}`}>
              <span>Your message</span>
              <textarea
                value={feedbackMessage}
                onChange={(event) => {
                  const next = event.target.value.slice(0, FEEDBACK_MESSAGE_MAX_LENGTH);
                  setFeedbackMessage(next);
                  if (feedbackStatus.kind !== "idle") setFeedbackStatus({ kind: "idle", message: "" });
                }}
                placeholder="Tell me what broke, what looks weird, or what feature you want..."
                maxLength={FEEDBACK_MESSAGE_MAX_LENGTH}
                disabled={feedbackSendBusy}
              />
              <small>{remaining} characters left</small>
            </label>

            {feedbackStatus.message ? (
              <div className={`feedbackStatusV331 ${feedbackStatus.kind}`} role="status">
                {feedbackStatus.message}
              </div>
            ) : null}

            <div className="feedbackPromptActionsV331">
              <button
                type="button"
                className="feedbackMaybeButtonV331"
                onClick={() => closeFeedbackPrompt()}
                disabled={feedbackSendBusy}
              >
                Maybe later
              </button>
              <button
                type="button"
                className={`feedbackSendButtonV331 ${feedbackReady ? "isReady" : "isLocked"} ${feedbackSendBusy ? "isSending" : ""}`}
                onClick={submitFeedbackPrompt}
                disabled={feedbackSendBusy || feedbackStatus.kind === "success" || !feedbackReady}
              >
                <span className="feedbackSendTextV334">{feedbackStatus.kind === "success" ? "Sent" : feedbackSendBusy ? "Sending..." : "Send"}</span>
                <span className="feedbackSendSparkV334" aria-hidden="true"><Send size={14} strokeWidth={2.4} /></span>
              </button>
            </div>
          </div>
        </div>
    );
  }
