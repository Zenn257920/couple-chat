// Display names for the couple. Internal sender ids in the DB/API
// stay 'kaung' / 'love' — only what is shown on screen changes here.
// The "love" display name is editable in the app settings (stored in
// localStorage); this is the default.
export type Sender = "kaung" | "love";

export const DEFAULT_DISPLAY_NAMES: Record<Sender, string> = {
  kaung: "ကိုကို",
  love: "ကလေးလေး",
};

export function displayName(
  sender: Sender,
  names: Record<Sender, string> = DEFAULT_DISPLAY_NAMES,
): string {
  return names[sender] ?? DEFAULT_DISPLAY_NAMES[sender];
}

export function otherSender(sender: Sender): Sender {
  return sender === "kaung" ? "love" : "kaung";
}
