import { useRef, useState } from "react";

export type FeedbackCategoryId = "bug" | "ui" | "feature" | "other";
export type FeedbackStatus = { kind: "idle" | "success" | "error"; message: string };
export type LocaltifyPerformanceStatus = {
  ok?: boolean;
  appVersion?: string;
  electronVersion?: string;
  chromeVersion?: string;
  nodeVersion?: string;
  platform?: string;
  arch?: string;
  isPackaged?: boolean;
  gpuFeatureStatus?: Record<string, unknown>;
  window?: Record<string, unknown>;
};

export type FeedbackConfigStatus = {
  ok?: boolean;
  configured?: boolean;
  valid?: boolean;
  envName?: string;
  status?: string;
  label?: string;
  message?: string;
} | null;

export function useFeedbackController() {
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);
  const [performanceStatus, setPerformanceStatus] = useState<LocaltifyPerformanceStatus | null>(null);
  const feedbackPromptBlockersRef = useRef({
    onboardingOpen: false,
    settingsOpen: false,
    whatsNewOpen: false,
    editorOpen: false,
    playlistPickerOpen: false,
    deleteOpen: false,
    importBusy: false,
    downloadBusy: false,
    spotifyDownloadBusy: false,
    libraryScanBusy: false
  });
  const [feedbackPromptOpen, setFeedbackPromptOpen] = useState(false);
  const [feedbackPromptManualOpen, setFeedbackPromptManualOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<FeedbackCategoryId>("bug");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSendBusy, setFeedbackSendBusy] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>({ kind: "idle", message: "" });
  const [feedbackConfigStatus, setFeedbackConfigStatus] = useState<FeedbackConfigStatus>(null);
  const feedbackLastSentAtRef = useRef(0);

  return {
    diagnosticsCopied, setDiagnosticsCopied,
    performanceStatus, setPerformanceStatus,
    feedbackPromptBlockersRef,
    feedbackPromptOpen, setFeedbackPromptOpen,
    feedbackPromptManualOpen, setFeedbackPromptManualOpen,
    feedbackCategory, setFeedbackCategory,
    feedbackMessage, setFeedbackMessage,
    feedbackSendBusy, setFeedbackSendBusy,
    feedbackStatus, setFeedbackStatus,
    feedbackConfigStatus, setFeedbackConfigStatus,
    feedbackLastSentAtRef
  };
}
