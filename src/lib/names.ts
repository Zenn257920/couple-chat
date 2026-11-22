// Display names shown on screen. Internal sender ids in the DB/API
// stay 'kaung' / 'love' — only what is shown on screen changes here.
// Defaults are "Person 1" (Kaung) and "Person 2" (his girlfriend);
// each phone can still rename them in Settings (localStorage).
export type Sender = "kaung" | "love";

export const DEFAULT_DISPLAY_NAMES: Record<Sender, string> = {
  kaung: "Person 1",
  love: "Person 2",
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
