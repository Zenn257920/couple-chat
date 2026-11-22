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
  const [draftNames, setDraftNames] = useState<Names>({
    ...DEFAULT_DISPLAY_NAMES,
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingPing = useRef(0);
  // Long-press (react menu) + swipe-right (reply) gesture state.
  const longPressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const longPressedRef = useRef(false);
  const touchStartX = useRef<number | null>(null);
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
  }, [messages, identity, names, typingFrom]);

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

  function insertEmoji(emoji: string) {
    const el = inputRef.current;
    const start = el?.selectionStart ?? input.length;
    const end = el?.selectionEnd ?? input.length;
    const next = input.slice(0, start) + emoji + input.slice(end);
    setInput(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
    pingTyping();
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
          <h1 className="mt-6 text-2xl font-bold text-ink">
            Person 1 &amp; Person 2
          </h1>
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
                  onClick={() => insertEmoji(e)}
                  className="rounded-lg py-1 text-xl transition active:scale-125"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
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
              pingTyping();
            }}
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
          <button
            onClick={() => void sendMessage()}
            disabled={!input.trim() || sending}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ocean text-lg text-white shadow-md transition active:scale-95 disabled:opacity-40"
            aria-label="Send"
          >
            ➤
          </button>
        </div>
        <p className="mt-1.5 text-center text-[11px] text-ink-soft">
          Just the two of you — text messages only (v1)
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
