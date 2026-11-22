// Emojis allowed as message reactions (Telegram-style quick reactions).
// Kept in one place so the API and the picker always agree.
export const REACTION_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🙏", "🔥", "🎉"] as const;

export function isReactionEmoji(value: unknown): value is (typeof REACTION_EMOJIS)[number] {
  return typeof value === "string" && (REACTION_EMOJIS as readonly string[]).includes(value);
}
