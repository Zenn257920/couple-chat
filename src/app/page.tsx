"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_DISPLAY_NAMES,
  displayName,
  otherSender,
  type Sender,
} from "@/lib/names";
import { REACTION_EMOJIS } from "@/lib/reactions";
import type { ChatMessage } from "@/lib/db";

const IDENTITY_KEY = "lovechat.identity";
// v2: names reset when the defaults changed to Person 1 / Person 2,
// so phones that stored the old Burmese names pick up the new ones.
const NAMES_KEY = "lovechat.names.v2";
const POLL_MS = 1500;

// Built-in emoji picker — no extra dependency, just a grid of common
// emojis grouped by category. Tapping one inserts it at the cursor.
const EMOJI_GROUPS: { label: string; icon: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    icon: "😀",
    emojis: ["😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😜", "🤪", "😎", "🥹", "😭", "😡", "🥰", "😴", "🤔", "🙃", "😇"],
  },
  {
    label: "Hearts",
    icon: "❤️",
    emojis: ["❤️", "💙", "💜", "🩷", "🧡", "💛", "💚", "🤍", "💔", "💕", "💖", "💘", "👍", "👎", "👏", "🙏", "🤝", "✌️", "🤞", "🫶", "👋", "🫰"],
  },
  {
    label: "Animals",
    icon: "🐶",
    emojis: ["🐶", "🐱", "🐰", "🦊", "🐼", "🐨", "🦁", "🐸", "🐵", "🦄", "🐷", "🐥", "🦋", "🐢"],
  },
  {
    label: "Food",
    icon: "🍕",
    emojis: ["🍕", "🍔", "🍟", "🍩", "🍰", "☕", "🧋", "🍜", "🍣", "🍓", "🍉", "🍿", "🍦", "🍪"],
  },
  {
    label: "Fun",
    icon: "🎉",
    emojis: ["⚽", "🏀", "🎮", "🎵", "🎬", "📚", "✈️", "🚗", "🎉", "🎁", "💐", "🌹", "🎄", "🎃"],
  },
  {
    label: "Things",
    icon: "📱",
    emojis: ["📱", "💻", "⌚", "👓", "🕶️", "👗", "👟", "🎒", "💄", "💍", "🔑", "🎈", "🌙", "⭐"],
  },
];

type Names = Record<Sender, string>;

function loadNames(): Names {
  try {
    const raw = localStorage.getItem(NAMES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Names>;
      return {
        kaung: parsed.kaung?.trim() || DEFAULT_DISPLAY_NAMES.kaung,
        love: parsed.love?.trim() || DEFAULT_DISPLAY_NAMES.love,
      };
    }
  } catch {
    // fall through to defaults
  }
  return { ...DEFAULT_DISPLAY_NAMES };
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Yangon",
  });
}

// Voice message durations as m:ss.
function formatVoiceTime(total: number): string {
  const s = Math.max(0, Math.floor(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Yangon",
  });
}

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "Asia/Yangon",
  });
}

export default function Home() {
  const [identity, setIdentity] = useState<Sender | null>(null);
  const [names, setNames] = useState<Names>({ ...DEFAULT_DISPLAY_NAMES });
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingFrom, setTypingFrom] = useState<Sender | null>(null);
  const [input, setInput] = useState("");
  // Height of the visible area while the on-screen keyboard is open
  // (the visual viewport shrinks when it appears). When set, the chat
  // is sized to exactly that height so the latest message sits right
  // above the keyboard instead of hiding behind it.
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiTab, setEmojiTab] = useState(0);
  // Message the user is replying to (Telegram-style quote).
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  // Message the long-press react menu is open for.
  const [reactMenuFor, setReactMenuFor] = useState<ChatMessage | null>(null);
  // Voice messages: tap the mic to record, tap stop, then send.
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [voicePreview, setVoicePreview] = useState<{
    url: string;
    blob: Blob;
    seconds: number;
    mime: string;
  } | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<number | null>(null);
  const [draftNames, setDraftNames] = useState<Names>({
    ...DEFAULT_DISPLAY_NAMES,
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Cursor/selection in the composer, remembered across emoji-picker
  // taps. The textarea loses focus (and selectionStart resets) when
  // the picker opens, so insertEmoji reads this instead of the DOM.
  const cursorRef = useRef<{ start: number; end: number } | null>(null);
  const lastTypingPing = useRef(0);
  // Long-press (react menu) + swipe-right (reply) gesture state.
  const longPressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const longPressedRef = useRef(false);
  const touchStartX = useRef<number | null>(null);
  // Voice recording / playback refs.
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<number | null>(null);
  const recStartedAtRef = useRef(0);
  const discardVoiceRef = useRef(false);
  const audioCacheRef = useRef(new Map<number, string>());
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  // Last incoming message id we already alerted for, so a poll that
  // re-fetches the same messages doesn't ding again. The first load
  // just records the latest id (old messages must not ding).
  const lastNotifiedId = useRef(0);
  const hydratedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const identityRef = useRef<Sender | null>(null);
  identityRef.current = identity;

  // Load identity + names from this phone on first open.
  useEffect(() => {
    setNames(loadNames());
    const saved = localStorage.getItem(IDENTITY_KEY);
    if (saved === "kaung" || saved === "love") setIdentity(saved);
    setReady(true);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "end",
    });
  }, []);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/messages", { cache: "no-store" });
      if (!res.ok) throw new Error("load failed");
      const data = (await res.json()) as {
        messages: ChatMessage[];
        typing: { sender: Sender } | null;
      };
      setConnected(true);
      setLoadError("");
      const me = identityRef.current;
      setMessages((prev) => {
        const changed =
          prev.length !== data.messages.length ||
          prev.some(
            (m, i) =>
              m.id !== data.messages[i]?.id ||
              m.reply_to_id !== data.messages[i]?.reply_to_id ||
              JSON.stringify(m.reactions) !==
                JSON.stringify(data.messages[i]?.reactions),
          );
        if (!changed) return prev;
        // Auto-scroll if we were already near the bottom.
        const el = listRef.current;
        const nearBottom = el
          ? el.scrollHeight - el.scrollTop - el.clientHeight < 160
          : true;
        if (nearBottom) requestAnimationFrame(() => scrollToBottom());
        return data.messages;
      });
      setTypingFrom(
        data.typing && me && data.typing.sender !== me
          ? data.typing.sender
          : null,
      );
      // Alert (soft ding + vibration) for new messages from the other
      // person. First load only records the latest id.
      const incoming = data.messages.filter((m) => me && m.sender !== me);
      const newest = incoming[incoming.length - 1];
      if (newest) {
        if (!hydratedRef.current) {
          hydratedRef.current = true;
          lastNotifiedId.current = newest.id;
        } else if (newest.id > lastNotifiedId.current) {
          lastNotifiedId.current = newest.id;
          notifyIncoming();
        }
      }
      // Mark the other person's messages as read.
      const last = data.messages[data.messages.length - 1];
      if (me && last && last.sender !== me) {
        void fetch("/api/messages/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sender: me }),
        }).catch(() => {});
      }
    } catch {
      setConnected(false);
      setLoadError("No internet connection yet — retrying…");
    }
  }, [scrollToBottom]);

  // Poll every 1.5s for new messages / typing / read state.
  useEffect(() => {
    if (!identity) return;
    void fetchState();
    const t = setInterval(() => void fetchState(), POLL_MS);
    return () => clearInterval(t);
  }, [identity, fetchState]);

  // Keep the latest message visible above the on-screen keyboard.
  // When the keyboard opens, the visual viewport shrinks; size the
  // chat to exactly the visible height and scroll to the bottom, so
  // the newest message lands right above the keyboard. When the
  // keyboard closes, the visible height is full again and the
  // override is cleared.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      if (vv.height < window.innerHeight - 100) {
        setViewportHeight(vv.height);
        requestAnimationFrame(() => scrollToBottom(false));
        window.setTimeout(() => scrollToBottom(false), 300);
      } else {
        setViewportHeight(null);
      }
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, [scrollToBottom]);

  // Memoize the message list so typing in the composer — which
  // re-renders this component on every keystroke — does not re-render
  // all 200 bubbles. That full re-render per keystroke was the typing
  // lag. The list only rebuilds when the messages, identity, names,
  // or typing indicator actually change.
  const renderedMessages = useMemo(() => {
    if (messages.length === 0) return null;
    return (
      <div className="flex flex-col gap-1.5">
        {messages.map((m, i) => {
          const own = m.sender === identity;
          const prev = messages[i - 1];
          const showDay =
            !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
          const showName =
            !own && (!prev || prev.sender !== m.sender || showDay);
          return (
            <div key={m.id} id={`msg-${m.id}`} className="fade-up">
              {showDay && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-ice-deep px-3 py-1 text-xs font-semibold text-ink-soft">
                    {formatDay(m.created_at)}
                  </span>
                </div>
              )}
              <div
                className={`flex ${own ? "justify-end" : "justify-start"}`}
                onPointerDown={(e) => onMessagePressStart(e, m)}
                onPointerMove={onMessagePressMove}
                onPointerUp={onMessagePressEnd}
                onPointerLeave={onMessagePressEnd}
                onPointerCancel={onMessagePressEnd}
                onTouchStart={onMessageTouchStart}
                onTouchEnd={(e) => onMessageTouchEnd(e, m)}
                onContextMenu={(e) => e.preventDefault()}
              >
                <div
                  className={`relative max-w-[78%] rounded-2xl px-3.5 py-2 shadow-sm select-none ${
                    own
                      ? "rounded-br-md bg-ocean text-white"
                      : "rounded-bl-md bg-card text-ink"
                  }`}
                >
                  {/* Telegram-style tail */}
                  <span
                    aria-hidden
                    className={`absolute bottom-0 h-3 w-3 rotate-45 ${
                      own ? "-right-1 bg-ocean" : "-left-1 bg-card"
                    }`}
                  />
                  {m.reply_to && (
                    <button
                      type="button"
                      onClick={() => {
                        // A tap right after a long-press opened the menu
                        // is the menu tap, not a jump request.
                        if (longPressedRef.current) {
                          longPressedRef.current = false;
                          return;
                        }
                        jumpToMessage(m.reply_to!.id);
                      }}
                      className={`mb-1 block w-full rounded-lg border-l-[3px] px-2 py-1 text-left ${
                        own
                          ? "border-blue-200 bg-white/15"
                          : "border-ocean bg-ice"
                      }`}
                    >
                      <span
                        className={`block text-xs font-bold ${
                          own ? "text-blue-100" : "text-ocean"
                        }`}
                      >
                        {displayName(m.reply_to.sender, names)}
                      </span>
                      <span
                        className={`block truncate text-xs ${
                          own ? "text-blue-100/90" : "text-ink-soft"
                        }`}
                      >
                        {m.reply_to.body}
                      </span>
                    </button>
                  )}
                  {showName && (
                    <p className="mb-0.5 text-xs font-bold text-ocean-light">
                      {displayName(m.sender, names)}
                    </p>
                  )}
                  {m.kind === "voice" && m.has_audio ? (
                    <div>
                      <div className="flex items-center gap-2 py-0.5">
                        <button
                          type="button"
                          onClick={() => void togglePlay(m)}
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base shadow-sm transition active:scale-95 ${
                            own ? "bg-white/25 text-white" : "bg-ocean text-white"
                          }`}
                          aria-label={
                            playingId === m.id
                              ? "Pause voice message"
                              : "Play voice message"
                          }
                        >
                          {loadingAudioId === m.id
                            ? "…"
                            : playingId === m.id
                              ? "⏸"
                              : "▶"}
                        </button>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div
                            className="flex h-3.5 items-center gap-[2px]"
                            aria-hidden
                          >
                            {Array.from({ length: 22 }).map((_, i) => (
                              <span
                                key={i}
                                className={`w-[3px] shrink-0 rounded-full ${
                                  own ? "bg-white/70" : "bg-ocean/60"
                                }`}
                                style={{ height: `${6 + ((i * 7) % 10)}px` }}
                              />
                            ))}
                          </div>
                          <div className="h-1 w-full overflow-hidden rounded-full bg-black/10">
                            <div
                              id={`voice-progress-${m.id}`}
                              className={`h-full rounded-full ${
                                own ? "bg-white" : "bg-ocean"
                              }`}
                              style={{ width: "0%" }}
                            />
                          </div>
                        </div>
                        <span
                          id={`voice-time-${m.id}`}
                          className={`shrink-0 text-[11px] ${
                            own ? "text-blue-200" : "text-ink-soft"
                          }`}
                        >
                          {formatVoiceTime(m.audio_duration ?? 0)}
                        </span>
                      </div>
                      <p
                        className={`mt-1 text-right text-[11px] ${
                          own ? "text-blue-200" : "text-ink-soft"
                        }`}
                      >
                        {formatTime(m.created_at)}
                        {own && (
                          <span className="ml-1">
                            {m.read_at ? "✓✓" : "✓"}
                          </span>
                        )}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                      {m.body}
                      {/* Time + ticks ride inside the bubble at the end
                          of the last line, like Telegram. */}
                      <span
                        className={`float-right mt-1 ml-2 text-[11px] leading-none ${
                          own ? "text-blue-200" : "text-ink-soft"
                        }`}
                      >
                        {formatTime(m.created_at)}
                        {own && (
                          <span className="ml-1">
                            {m.read_at ? "✓✓" : "✓"}
                          </span>
                        )}
                      </span>
                    </p>
                  )}
                </div>
              </div>
              {m.reactions.length > 0 && (
                <div
                  className={`mt-1 flex flex-wrap gap-1 ${
                    own ? "justify-end" : "justify-start"
                  }`}
                >
                  {m.reactions.map((g) => {
                    const mine =
                      !!identity && g.senders.includes(identity);
                    return (
                      <button
                        key={g.emoji}
                        type="button"
                        onClick={() => void reactTo(m.id, g.emoji)}
                        className={`rounded-full border px-2 py-0.5 text-xs shadow-sm transition active:scale-95 ${
                          mine
                            ? "border-ocean bg-ocean text-white"
                            : "border-line bg-card text-ink"
                        }`}
                      >
                        {g.emoji}
                        {g.senders.length > 1 ? ` ${g.senders.length}` : ""}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {typingFrom && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-card px-4 py-3 shadow-sm">
              <span className="flex items-center gap-1.5">
                <span className="typing-dot inline-block h-2 w-2 rounded-full bg-ocean" />
                <span className="typing-dot inline-block h-2 w-2 rounded-full bg-ocean" />
                <span className="typing-dot inline-block h-2 w-2 rounded-full bg-ocean" />
                <span className="ml-1 text-xs text-ink-soft">
                  {displayName(typingFrom, names)} is typing…
                </span>
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    );
  }, [messages, identity, names, typingFrom, playingId, loadingAudioId]);

  // Register this phone for full push notifications (APK only). FCM
  // gives the phone a device token; the server stores it so a message
  // from the other person can wake this phone with a system
  // notification, even when the app is closed. No-ops on the web, and
  // fails quietly until Firebase is configured (google-services.json
  // in the APK + FIREBASE_* env vars on the server).
  useEffect(() => {
    if (!identity) return;
    let cancelled = false;
    void (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { PushNotifications } = await import(
          "@capacitor/push-notifications"
        );
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== "granted") return;
        await PushNotifications.addListener("registration", (t) => {
          if (cancelled) return;
          void fetch("/api/push/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sender: identity, token: t.value }),
          }).catch(() => {});
        });
        await PushNotifications.addListener("registrationError", () => {});
        await PushNotifications.register();
      } catch {
        // Push unavailable (web, or Firebase not configured yet).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [identity]);

  // Scroll to bottom once messages first load.
  useEffect(() => {
    if (messages.length) scrollToBottom(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length === 0]);

  function pickIdentity(sender: Sender) {
    localStorage.setItem(IDENTITY_KEY, sender);
    setIdentity(sender);
    setShowSettings(false);
    ensureAudio();
  }

  function saveNames() {
    const cleaned: Names = {
      kaung: draftNames.kaung.trim() || DEFAULT_DISPLAY_NAMES.kaung,
      love: draftNames.love.trim() || DEFAULT_DISPLAY_NAMES.love,
    };
    localStorage.setItem(NAMES_KEY, JSON.stringify(cleaned));
    setNames(cleaned);
    setShowSettings(false);
  }

  // In-app alert for incoming messages: a soft two-tone ding (WebAudio,
  // no sound file needed) plus a short vibration on the phone.
  // Browsers only allow audio after a user gesture, so the context is
  // created/resumed from taps (pickIdentity / sendMessage) — if it is
  // still locked, the alert is silently skipped.
  function ensureAudio(): AudioContext | null {
    try {
      if (!audioCtxRef.current) {
        const AC =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AC) return null;
        audioCtxRef.current = new AC();
      }
      if (audioCtxRef.current.state === "suspended") {
        void audioCtxRef.current.resume();
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }

  function playDing() {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [880, 1174.66].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.15, now + i * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.25);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.3);
      });
    } catch {
      // Audio unavailable — vibration below still fires.
    }
  }

  function notifyIncoming() {
    playDing();
    try {
      navigator.vibrate?.([120, 60, 120]);
    } catch {
      // Vibration unsupported — ignore.
    }
  }

  // Insert an emoji at the cursor WITHOUT focusing the textarea.
  // Focusing it opens the system keyboard, which shrinks the visual
  // viewport, resizes the whole chat and scrolls it to the bottom —
  // on every single emoji tap the screen jumped like a reload, so
  // picking 2–3 emojis in a row was hard. The picker stays open,
  // the keyboard stays closed, and the layout does not move at all.
  // The cursor is only re-placed when the textarea is already
  // focused (keyboard already open), which causes no viewport change.
  function insertEmoji(emoji: string) {
    const el = inputRef.current;
    const current = el?.value ?? input;
    const start =
      cursorRef.current?.start ?? el?.selectionStart ?? current.length;
    const end = cursorRef.current?.end ?? el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + emoji + current.slice(end);
    cursorRef.current = {
      start: start + emoji.length,
      end: start + emoji.length,
    };
    setInput(next);
    if (el && document.activeElement === el) {
      requestAnimationFrame(() => {
        const pos = cursorRef.current?.start ?? next.length;
        el.setSelectionRange(pos, pos);
      });
    }
    pingTyping();
  }

  // Keep the remembered cursor in sync whenever the user taps or
  // types in the composer, so the next emoji lands where they left it.
  function rememberCursor() {
    const el = inputRef.current;
    if (!el) return;
    cursorRef.current = {
      start: el.selectionStart ?? el.value.length,
      end: el.selectionEnd ?? el.value.length,
    };
  }

  function pingTyping() {
    if (!identity) return;
    const now = Date.now();
    if (now - lastTypingPing.current < 2000) return;
    lastTypingPing.current = now;
    void fetch("/api/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: identity }),
    }).catch(() => {});
  }

  async function sendMessage() {
    const body = input.trim();
    if (!body || !identity || sending) return;
    ensureAudio();
    setSending(true);
    setInput("");
    cursorRef.current = null;
    setShowEmoji(false);
    const replyingTo = replyTo;
    setReplyTo(null);
    const optimistic: ChatMessage = {
      id: -Date.now(),
      sender: identity,
      body,
      kind: "text",
      created_at: new Date().toISOString(),
      read_at: null,
      reply_to_id: replyingTo?.id ?? null,
      reply_to: replyingTo
        ? { id: replyingTo.id, sender: replyingTo.sender, body: replyingTo.body }
        : null,
      reactions: [],
      audio_duration: null,
      audio_mime: null,
      has_audio: false,
    };
    setMessages((prev) => [...prev, optimistic]);
    requestAnimationFrame(() => scrollToBottom());
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: identity,
          body,
          replyToId: replyingTo?.id ?? null,
        }),
      });
      if (!res.ok) throw new Error("send failed");
      const data = (await res.json()) as { message: ChatMessage };
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? data.message : m)),
      );
      await fetchState();
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(body);
      setReplyTo(replyingTo);
      setLoadError("Message didn't send — check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  // --- Telegram-style reactions & replies ---

  // Toggle my reaction to an emoji on a message. Optimistic: update
  // locally right away; the poll corrects it within 1.5s anyway.
  async function reactTo(messageId: number, emoji: string) {
    if (!identity) return;
    const me = identity;
    setReactMenuFor(null);
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const mine = m.reactions.find((g) => g.senders.includes(me));
        let reactions = m.reactions
          .map((g) => ({ ...g, senders: g.senders.filter((s) => s !== me) }))
          .filter((g) => g.senders.length > 0);
        if (!mine || mine.emoji !== emoji) {
          const group = reactions.find((g) => g.emoji === emoji);
          if (group) group.senders.push(me);
          else reactions = [...reactions, { emoji, senders: [me] }];
        }
        return { ...m, reactions };
      }),
    );
    try {
      await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: me, messageId, emoji }),
      });
    } catch {
      // Poll will correct the optimistic state.
    }
    void fetchState();
  }

  // Long-press (500ms, no move) opens the react menu for a message.
  function onMessagePressStart(e: React.PointerEvent, m: ChatMessage) {
    pressStart.current = { x: e.clientX, y: e.clientY };
    longPressedRef.current = false;
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      longPressedRef.current = true;
      setReactMenuFor(m);
      if (navigator.vibrate) navigator.vibrate(10);
    }, 500);
  }
  function onMessagePressMove(e: React.PointerEvent) {
    const start = pressStart.current;
    if (!start) return;
    if (Math.abs(e.clientX - start.x) > 10 || Math.abs(e.clientY - start.y) > 10) {
      if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
      pressStart.current = null;
    }
  }
  function onMessagePressEnd() {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    pressStart.current = null;
  }

  // Swipe right on a message to reply to it (Telegram gesture).
  function onMessageTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onMessageTouchEnd(e: React.TouchEvent, m: ChatMessage) {
    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX === null) return;
    if (e.changedTouches[0].clientX - startX > 60) {
      setReplyTo(m);
      inputRef.current?.focus();
    }
  }

  // Jump to the quoted message when its quote is tapped.
  function jumpToMessage(id: number) {
    document
      .getElementById(`msg-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // --- Voice messages ---

  const MAX_VOICE_SECONDS = 120;

  // Stop the mic stream and timer (also used as an unmount cleanup).
  function stopVoiceCapture() {
    if (recTimerRef.current) window.clearInterval(recTimerRef.current);
    recTimerRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  }

  // Release the mic if this screen ever unmounts mid-recording.
  useEffect(() => () => stopVoiceCapture(), []);

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError("Voice recording isn't supported on this phone.");
      return;
    }
    setVoiceError("");
    setVoicePreview(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "";
      const rec = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 24000,
      });
      mediaChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) mediaChunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stopVoiceCapture();
        if (discardVoiceRef.current) {
          discardVoiceRef.current = false;
          return;
        }
        const blob = new Blob(mediaChunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        const seconds = Math.max(
          1,
          Math.round((Date.now() - recStartedAtRef.current) / 1000),
        );
        setVoicePreview({
          url: URL.createObjectURL(blob),
          blob,
          seconds,
          mime: blob.type || "audio/webm",
        });
      };
      mediaRecorderRef.current = rec;
      mediaStreamRef.current = stream;
      recStartedAtRef.current = Date.now();
      rec.start(250);
      setRecSeconds(0);
      setIsRecording(true);
      recTimerRef.current = window.setInterval(() => {
        const s = Math.floor((Date.now() - recStartedAtRef.current) / 1000);
        setRecSeconds(s);
        if (s >= MAX_VOICE_SECONDS) stopRecording();
      }, 500);
    } catch {
      setVoiceError(
        "Mic is blocked — allow microphone permission for this app, then tap the mic again.",
      );
    }
  }

  function stopRecording() {
    if (recTimerRef.current) window.clearInterval(recTimerRef.current);
    recTimerRef.current = null;
    setIsRecording(false);
    const rec = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (rec && rec.state !== "inactive") rec.stop();
  }

  function cancelRecording() {
    discardVoiceRef.current = true;
    stopRecording();
    setVoicePreview(null);
    setRecSeconds(0);
  }

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1] ?? "");
      };
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(blob);
    });
  }

  async function sendVoice() {
    if (!voicePreview || !identity || sending) return;
    ensureAudio();
    setSending(true);
    const preview = voicePreview;
    setVoicePreview(null);
    setPreviewPlaying(false);
    const replyingTo = replyTo;
    setReplyTo(null);
    const optimistic: ChatMessage = {
      id: -Date.now(),
      sender: identity,
      body: "🎤 Voice message",
      kind: "voice",
      created_at: new Date().toISOString(),
      read_at: null,
      reply_to_id: replyingTo?.id ?? null,
      reply_to: replyingTo
        ? { id: replyingTo.id, sender: replyingTo.sender, body: replyingTo.body }
        : null,
      reactions: [],
      audio_duration: preview.seconds,
      audio_mime: preview.mime,
      has_audio: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    requestAnimationFrame(() => scrollToBottom());
    try {
      const base64 = await blobToBase64(preview.blob);
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: identity,
          kind: "voice",
          audioBase64: base64,
          audioDuration: preview.seconds,
          audioMime: preview.mime,
          replyToId: replyingTo?.id ?? null,
        }),
      });
      if (!res.ok) throw new Error("send failed");
      const data = (await res.json()) as { message: ChatMessage };
      // Cache the local recording so the sender can play it instantly
      // without re-downloading it.
      audioCacheRef.current.set(data.message.id, preview.url);
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? data.message : m)),
      );
      await fetchState();
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setLoadError("Voice message didn't send — check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  function togglePreviewPlay() {
    if (!voicePreview) return;
    const audio = previewAudioRef.current ?? new Audio();
    previewAudioRef.current = audio;
    if (previewPlaying) {
      audio.pause();
      setPreviewPlaying(false);
      return;
    }
    audio.src = voicePreview.url;
    audio.onended = () => setPreviewPlaying(false);
    void audio.play().then(
      () => setPreviewPlaying(true),
      () => setVoiceError("Couldn't play this recording."),
    );
  }

  // Update a voice bubble's progress bar + time label directly in the
  // DOM: the list is memoized, so React state here would rebuild all
  // 200 bubbles ~4 times a second while playing.
  function updateVoiceProgress(m: ChatMessage, current: number, total: number) {
    const bar = document.getElementById(`voice-progress-${m.id}`);
    if (bar && total > 0) bar.style.width = `${Math.min(100, (current / total) * 100)}%`;
    const label = document.getElementById(`voice-time-${m.id}`);
    if (label) label.textContent = formatVoiceTime(current);
  }

  function resetVoiceProgress(m: ChatMessage) {
    const bar = document.getElementById(`voice-progress-${m.id}`);
    if (bar) bar.style.width = "0%";
    const label = document.getElementById(`voice-time-${m.id}`);
    if (label) label.textContent = formatVoiceTime(m.audio_duration ?? 0);
  }

  async function togglePlay(m: ChatMessage) {
    if (!m.has_audio) return;
    const audio = audioElRef.current ?? new Audio();
    audioElRef.current = audio;
    if (playingId === m.id) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    audio.pause();
    if (playingId !== null) {
      const prev = messages.find((x) => x.id === playingId);
      if (prev) resetVoiceProgress(prev);
    }
    let url = audioCacheRef.current.get(m.id);
    if (!url) {
      setLoadingAudioId(m.id);
      try {
        const res = await fetch(`/api/audio?id=${m.id}`);
        if (!res.ok) throw new Error("load failed");
        const data = (await res.json()) as {
          audioBase64: string;
          audioMime: string;
          audioDuration: number;
        };
        const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: data.audioMime || "audio/webm" });
        url = URL.createObjectURL(blob);
        audioCacheRef.current.set(m.id, url);
      } catch {
        setLoadingAudioId(null);
        setLoadError("Couldn't load this voice message — try again.");
        return;
      } finally {
        setLoadingAudioId(null);
      }
    }
    audio.src = url;
    audio.onended = () => {
      setPlayingId(null);
      resetVoiceProgress(m);
    };
    audio.ontimeupdate = () => {
      if (audio.duration) updateVoiceProgress(m, audio.currentTime, audio.duration);
    };
    try {
      await audio.play();
      setPlayingId(m.id);
    } catch {
      setLoadError("Couldn't play this voice message.");
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ice">
        <p className="text-ink-soft">Loading… 💙</p>
      </div>
    );
  }

  // First-open identity picker: each phone picks who is using it.
  if (!identity) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-ice px-6 text-center">
        <div className="fade-up flex w-full max-w-sm flex-col items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-ocean text-4xl shadow-lg">
            💙
          </div>
          <h1 className="mt-6 text-2xl font-bold text-ink">We Talk</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Our private little chat 💙
            <br />
            Who&apos;s using this phone?
          </p>
          <div className="mt-8 flex w-full flex-col gap-3">
            {(["kaung", "love"] as Sender[]).map((s) => (
              <button
                key={s}
                onClick={() => pickIdentity(s)}
                className="w-full rounded-2xl bg-ocean px-6 py-4 text-lg font-bold text-white shadow-md transition active:scale-[0.98]"
              >
                I&apos;m {displayName(s, names)}
              </button>
            ))}
          </div>
          <p className="mt-6 text-xs text-ink-soft">
            You can change this later in Settings
          </p>
        </div>
      </div>
    );
  }

  const me = identity;
  const other = otherSender(me);
  const lastOwnRead = [...messages].reverse().find((m) => m.sender === me);

  return (
    <div
      className="mx-auto flex h-dvh w-full max-w-2xl flex-col bg-ice sm:border-x sm:border-line"
      style={viewportHeight ? { height: viewportHeight } : undefined}
    >
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-line bg-card px-4 py-3 shadow-sm">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ocean text-xl text-white">
          💙
          <span
            className={`absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${
              connected ? "bg-green-500" : "bg-gray-400"
            }`}
            title={connected ? "Online" : "Offline"}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold text-ink">
            {displayName("kaung", names)} &amp; {displayName("love", names)}
          </h1>
          <p
            className={`truncate text-xs ${
              typingFrom ? "text-ocean" : "text-ink-soft"
            }`}
          >
            {typingFrom
              ? `${displayName(typingFrom, names)} is typing…`
              : connected
                ? `Chatting with ${displayName(other, names)}`
                : "Offline — reconnecting…"}
          </p>
        </div>
        <button
          onClick={() => {
            setDraftNames({ ...names });
            setShowSettings(true);
          }}
          className="rounded-full bg-ice-deep px-3 py-2 text-sm font-semibold text-ocean transition active:scale-95"
          aria-label="Settings"
        >
          ⚙️ {displayName(me, names)}
        </button>
      </header>

      {/* Messages */}
      <div
        ref={listRef}
        className="chat-bg flex-1 overflow-y-auto px-4 py-4"
        onClick={() => {
          if (showSettings) setShowSettings(false);
          if (showEmoji) setShowEmoji(false);
        }}
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="text-5xl">💙</div>
            <p className="mt-4 text-lg font-bold text-ink">Hello 👋</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">
              A private little place for {displayName("kaung", names)} and{" "}
              {displayName("love", names)} — send the first message
            </p>
          </div>
        ) : (
          renderedMessages
        )}
        {messages.length === 0 && <div ref={bottomRef} />}
      </div>

      {loadError && (
        <p className="bg-card px-4 py-1.5 text-center text-xs text-red-600">
          {loadError}
        </p>
      )}

      {/* Read receipt hint for own last message */}
      {lastOwnRead?.read_at && (
        <p className="bg-ice px-4 pb-1 text-right text-[11px] text-ink-soft">
          {displayName(other, names)} read this ✓✓
        </p>
      )}

      {/* Composer */}
      <div className="border-t border-line bg-card px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border-l-4 border-ocean bg-ice px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-ocean">
                Replying to {displayName(replyTo.sender, names)}
              </p>
              <p className="truncate text-xs text-ink-soft">{replyTo.body}</p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="shrink-0 rounded-full px-2 py-1 text-ink-soft"
              aria-label="Cancel reply"
            >
              ✕
            </button>
          </div>
        )}
        {showEmoji && (
          <div className="mb-2 rounded-2xl border border-line bg-ice p-2 shadow-sm">
            <div className="flex gap-1">
              {EMOJI_GROUPS.map((g, i) => (
                <button
                  key={g.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setEmojiTab(i)}
                  className={`flex-1 rounded-xl py-1.5 text-lg ${
                    emojiTab === i ? "bg-ice-deep" : ""
                  }`}
                  aria-label={g.label}
                >
                  {g.icon}
                </button>
              ))}
            </div>
            <div className="mt-1 grid max-h-40 grid-cols-8 gap-0.5 overflow-y-auto">
              {EMOJI_GROUPS[emojiTab].emojis.map((e) => (
                <button
                  key={e}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertEmoji(e)}
                  className="rounded-lg py-1 text-xl transition active:scale-125"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
        {isRecording ? (
          <div className="flex items-center gap-2">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow-md">
              <span className="rec-dot h-3 w-3 rounded-full bg-white" />
            </span>
            <span className="flex-1 text-sm font-bold text-ink">
              Recording… {formatVoiceTime(recSeconds)} /{" "}
              {formatVoiceTime(MAX_VOICE_SECONDS)}
            </span>
            <button
              type="button"
              onClick={cancelRecording}
              className="rounded-full bg-ice-deep px-3 py-2 text-sm font-semibold text-ink-soft transition active:scale-95"
            >
              ✕ Cancel
            </button>
            <button
              type="button"
              onClick={stopRecording}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500 text-lg text-white shadow-md transition active:scale-95"
              aria-label="Stop recording"
            >
              ■
            </button>
          </div>
        ) : voicePreview ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePreviewPlay}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ocean text-lg text-white shadow-md transition active:scale-95"
              aria-label={previewPlaying ? "Pause preview" : "Play preview"}
            >
              {previewPlaying ? "⏸" : "▶"}
            </button>
            <span className="flex-1 text-sm font-semibold text-ink">
              Voice message • {formatVoiceTime(voicePreview.seconds)}
            </span>
            <button
              type="button"
              onClick={() => {
                setVoicePreview(null);
                setPreviewPlaying(false);
              }}
              className="rounded-full bg-ice-deep px-3 py-2 text-sm font-semibold text-ink-soft transition active:scale-95"
            >
              ✕ Cancel
            </button>
            <button
              type="button"
              onClick={() => void sendVoice()}
              disabled={sending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ocean text-lg text-white shadow-md transition active:scale-95 disabled:opacity-40"
              aria-label="Send voice message"
            >
              ➤
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                ensureAudio();
                setShowEmoji((v) => !v);
              }}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl shadow-md transition active:scale-95 ${
                showEmoji ? "bg-ocean text-white" : "bg-ice-deep text-ocean"
              }`}
              aria-label="Emoji"
            >
              😊
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                rememberCursor();
                pingTyping();
              }}
              onSelect={rememberCursor}
              onClick={rememberCursor}
              onFocus={() => {
                // Keyboard is opening — scroll the latest message up
                // above it (the visualViewport listener also fires and
                // re-scrolls once the keyboard finishes opening).
                requestAnimationFrame(() => scrollToBottom(false));
                window.setTimeout(() => scrollToBottom(false), 350);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              rows={1}
              placeholder={`Message ${displayName(other, names)}…`}
              maxLength={2000}
              className="max-h-32 flex-1 resize-none rounded-2xl border border-line bg-ice px-4 py-3 text-[15px] text-ink outline-none placeholder:text-ink-soft focus:border-ocean"
            />
            {input.trim() ? (
              <button
                onClick={() => void sendMessage()}
                disabled={sending}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ocean text-lg text-white shadow-md transition active:scale-95 disabled:opacity-40"
                aria-label="Send"
              >
                ➤
              </button>
            ) : (
              <button
                onClick={() => void startRecording()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ocean text-lg text-white shadow-md transition active:scale-95"
                aria-label="Record voice message"
              >
                🎤
              </button>
            )}
          </div>
        )}
        {voiceError && (
          <p className="mt-1.5 text-center text-xs text-red-600">{voiceError}</p>
        )}
        <p className="mt-1.5 text-center text-[11px] text-ink-soft">
          Just the two of you — text & voice
        </p>
      </div>

      {/* Long-press react menu (Telegram-style) */}
      {reactMenuFor && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setReactMenuFor(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-card p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 truncate text-center text-xs text-ink-soft">
              {displayName(reactMenuFor.sender, names)}: {reactMenuFor.body}
            </p>
            <div className="flex justify-around">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => void reactTo(reactMenuFor.id, emoji)}
                  className="rounded-full px-2 py-1 text-3xl transition active:scale-125"
                  aria-label={`React ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setReplyTo(reactMenuFor);
                setReactMenuFor(null);
                inputRef.current?.focus();
              }}
              className="mt-3 w-full rounded-xl bg-ice-deep px-4 py-3 text-sm font-bold text-ocean"
            >
              ↩ Reply to this message
            </button>
            <button
              type="button"
              onClick={() => setReactMenuFor(null)}
              className="mt-2 w-full rounded-xl px-4 py-2 text-sm font-semibold text-ink-soft"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Settings sheet */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl">
            <h2 className="text-lg font-bold text-ink">Settings</h2>
            <p className="mt-4 text-sm font-semibold text-ink-soft">
              Who&apos;s using this phone
            </p>
            <div className="mt-2 flex gap-2">
              {(["kaung", "love"] as Sender[]).map((s) => (
                <button
                  key={s}
                  onClick={() => pickIdentity(s)}
                  className={`flex-1 rounded-xl px-3 py-3 text-sm font-bold ${
                    me === s
                      ? "bg-ocean text-white"
                      : "bg-ice-deep text-ocean"
                  }`}
                >
                  {displayName(s, names)}
                </button>
              ))}
            </div>
            <label className="mt-5 block text-sm font-semibold text-ink-soft">
              Person 1&apos;s name
              <input
                value={draftNames.kaung}
                onChange={(e) =>
                  setDraftNames({ ...draftNames, kaung: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-line bg-ice px-3 py-2.5 text-ink outline-none focus:border-ocean"
              />
            </label>
            <label className="mt-3 block text-sm font-semibold text-ink-soft">
              Person 2&apos;s name
              <input
                value={draftNames.love}
                onChange={(e) =>
                  setDraftNames({ ...draftNames, love: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-line bg-ice px-3 py-2.5 text-ink outline-none focus:border-ocean"
              />
            </label>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 rounded-xl bg-ice-deep px-4 py-3 text-sm font-bold text-ink"
              >
                Close
              </button>
              <button
                onClick={saveNames}
                className="flex-1 rounded-xl bg-ocean px-4 py-3 text-sm font-bold text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
