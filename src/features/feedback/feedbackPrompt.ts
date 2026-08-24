export const FEEDBACK_PROMPT_SEEN_KEY = "localitfy.feedbackPrompt.seen.v1";
export const FEEDBACK_PROMPT_DELAY_MS = 40_000;
export const FEEDBACK_PROMPT_RETRY_DELAY_MS = 15_000;
export const FEEDBACK_MESSAGE_MAX_LENGTH = 1_500;
export const LOCALTIFY_041_WHATS_NEW_ITEMS = [
  "0.4.1 is a quick hotfix for the album library importer freezing during big nested-folder scans.",
  "Bulk album scanning now treats nested folders safer, so artist folders do not steal covers from child album folders.",
  "Album import progress is throttled more carefully so the app stays responsive during large imports.",
  "Linux AppImage startup and update-check noise from the 0.4.0 release path were cleaned up.",
  "Small release cleanup: version text, Linux install copy, and old development comments were tidied."
] as const;

export const FEEDBACK_PROMPT_COPY = {
  title: "Thanks for using localtify!",
  body: "really it has been amazing for users like you to keep using the app which make me want to update the app even more, why did this popup come? Well as you may know or may also have experienced localtify has few here and there visual or ui bugs in the app and that probably has made you angry. or maybe you really want a feature to be added.",
  footer: "Which is why below me theres a message box where you can send bug reports and suggestions. and I will be actively reviewing them! (also you can type feeback in search bar)"
} as const;

export const FEEDBACK_CATEGORY_OPTIONS = [
  { id: "bug", label: "Bug" },
  { id: "ui", label: "UI issue" },
  { id: "feature", label: "Feature request" },
  { id: "other", label: "Other" }
] as const;

export function shouldOpenFeedbackPromptFromSettingsSearch(value: string) {
  const query = value.trim().toLowerCase();
  return query === "/feedback" || query === "feedback";
}

export function shouldOpenFeedbackPromptFromGlobalSearch(value: string) {
  const query = value.trim().toLowerCase();
  return query === "/feedback" || query === "feedback";
}
