export const FEEDBACK_MESSAGE_MAX_LENGTH = 1_500;
export const FEEDBACK_PROMPT_COPY = {
  title: "Help make localtify better",
  body: "Found a bug, a confusing screen, or something that could work better? Share what happened and what you expected, or suggest a feature you would like to see.",
  footer: "Send your feedback below. You can also type feedback in the search bar to open this form again."
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
