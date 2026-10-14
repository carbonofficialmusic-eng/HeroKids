const FEEDBACK_EMAIL = "info@littlechamps.net";
const FEEDBACK_SUBJECT = "Little Champs Feedback";
const FEEDBACK_BODY = [
  "Hallo Little Champs Team,",
  "",
  "ich möchte euch folgendes Feedback geben:",
  "",
].join("\n");

export const FEEDBACK_MAILTO = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(FEEDBACK_SUBJECT)}&body=${encodeURIComponent(FEEDBACK_BODY)}`;