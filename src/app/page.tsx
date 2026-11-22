"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VoiceRecorder } from "capacitor-voice-recorder";
import {
  Camera,
  Check,
  CheckCheck,
  ChevronDown,
  Copy,
  Heart,
  LoaderCircle,
  Lock,
  Mic,
  Moon,
  PartyPopper,
  Pause,
  PawPrint,
  Pencil,
  Plane,
  Play,
  Reply,
  Send,
  Settings,
  Shapes,
  Smartphone,
  Smile,
  Square,
  Sun,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react";
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
const EMOJI_GROUPS: { label: string; icon: LucideIcon; emojis: string[] }[] = [
  {
    label: "Smileys",
    icon: Smile,
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥲", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "😎", "🤓", "🧐", "😕", "😟", "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺", "🥹", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "👻", "👽", "👾", "🤖", "🎃", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾"],
  },
  {
    label: "Love",
    icon: Heart,
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "👍", "👎", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✌️", "🤞", "🫰", "🤟", "🤘", "👌", "🤌", "🤏", "💪", "🫶", "👋", "🤙", "👊", "✊", "🤛", "🤜", "✍️", "💅", "🤳", "🫵", "👈", "👉", "👆", "👇", "☝️", "🫱", "🫲"],
  },
  {
    label: "Animals",
    icon: PawPrint,
    emojis: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐻‍❄️", "🐨", "🐯", "🦁", "🐮", "🐷", "🐽", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐜", "🦟", "🦗", "🕷️", "🐢", "🐍", "🦎", "🐙", "🦑", "🦐", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🐊", "🐅", "🐆", "🦓", "🦍", "🐘", "🦛", "🦏", "🐪", "🐫", "🦒", "🦘", "🐃", "🐂", "🐄", "🐎", "🐖", "🐏", "🐑", "🦙", "🐐", "🦌", "🐕", "🐩", "🐈", "🐓", "🦃", "🦚", "🦜", "🦢", "🦩", "🕊️", "🐇", "🦝", "🦨", "🦡", "🦦", "🐁", "🐀", "🐿️", "🦔"],
  },
  {
    label: "Food",
    icon: UtensilsCrossed,
    emojis: ["🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶️", "🫑", "🌽", "🥕", "🫒", "🧄", "🧅", "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🧈", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖", "🌭", "🍔", "🍟", "🍕", "🫓", "🥪", "🥙", "🧆", "🌮", "🌯", "🫔", "🥗", "🍲", "🍜", "🍝", "🍛", "🍣", "🍱", "🥟", "🦪", "🍤", "🍙", "🍚", "🍘", "🍥", "🥠", "🥮", "🍢", "🍡", "🍧", "🍨", "🍦", "🥧", "🧁", "🍰", "🎂", "🍮", "🍭", "🍬", "🍫", "🍿", "🍩", "🍪", "🌰", "🥜", "🍯", "🥛", "🍼", "☕", "🫖", "🍵", "🧃", "🥤", "🧋", "🍶", "🍺", "🍻", "🥂", "🍷", "🥃", "🍸", "🍹", "🧉", "🍾"],
  },
  {
    label: "Fun",
    icon: PartyPopper,
    emojis: ["⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🎱", "🪀", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🛹", "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛼", "🛷", "⛸️", "🥌", "🎿", "⛷️", "🏂", "🪂", "🏋️", "🤼", "🤸", "⛹️", "🤺", "🏌️", "🏇", "🧘", "🏊", "🚣", "🧗", "🚵", "🤾", "🎵", "🎶", "🎤", "🎧", "🎼", "🎹", "🥁", "🎷", "🎺", "🎸", "🪕", "🎻", "🎬", "🎭", "🎨", "🖼️", "🎰", "🎲", "🎯", "🎳", "🎮", "🕹️"],
  },
  {
    label: "Travel",
    icon: Plane,
    emojis: ["🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚛", "🚜", "🚲", "🛴", "🛵", "🏍️", "🚔", "🚍", "🚘", "🚖", "✈️", "🛫", "🛬", "🛩️", "💺", "🚀", "🛸", "🚁", "🛶", "⛵", "🚤", "🛥️", "🛳️", "⛴️", "🚢", "⚓", "🪝", "⛽", "🚧", "🚦", "🚥", "🗼", "🗽", "⛲", "🎡", "🎢", "🎠", "🏰", "🏯", "🗿", "🏟️", "🏛️"],
  },
  {
    label: "Things",
    icon: Smartphone,
    emojis: ["⌚", "📱", "📲", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "🖲️", "🕹️", "🗜️", "💽", "💾", "💿", "📀", "📼", "📷", "📸", "📹", "🎥", "📽️", "🎞️", "📞", "☎️", "📟", "📠", "📺", "📻", "🎙️", "🎚️", "🎛️", "🧭", "⏱️", "⏲️", "⏰", "🕰️", "⌛", "⏳", "📡", "🔋", "🔌", "💡", "🔦", "🕯️", "🪔", "🧯", "🛢️", "💸", "💵", "💴", "💶", "💷", "💰", "💳", "💎", "⚖️", "🧰", "🔧", "🔨", "⚒️", "🛠️", "⛏️", "🔩", "⚙️", "🧲", "🪛", "🔫", "💣", "🧨", "🪓", "🔪", "🗡️", "⚔️", "🛡️", "💊", "💉", "🧬", "🦠", "🧫", "🧪", "🌡️", "🧹", "🧺", "🧻", "🚽", "🚰", "🚿", "🛁", "🛀", "🧼", "🪒", "🧽", "🪣", "🧴", "🛎️", "🔑", "🗝️", "🚪", "🪑", "🛋️", "🛏️", "🧸", "🪆", "🖼️", "🪞", "🪟", "🛍️", "🛒", "🎁", "🎈", "🎏", "🎀", "🪄", "🪅", "🎊", "🎉", "🎎", "🏮", "🎐", "🧧", "✉️", "📩", "📨", "📧", "💌", "📥", "📤", "📦", "🏷️"],
  },
  {
    label: "Symbols",
    icon: Shapes,
    emojis: ["💯", "💮", "🛑", "⛔", "📛", "🚫", "💢", "💥", "💫", "💦", "💨", "🕳️", "💬", "👁️‍🗨️", "🗨️", "🗯️", "💭", "💤", "👁️", "👅", "👄", "💋", "🩸", "🧠", "🫀", "🫁", "🦷", "🦴", "👀", "👂", "🦻", "👃", "📪", "📫", "📬", "📭", "📮", "📯", "📜", "📃", "📄", "📑", "🧾", "📊", "📈", "📉", "📋", "📁", "📂", "🗂️", "🗞️", "📰", "📓", "📔", "📒", "📕", "📗", "📘", "📚", "📖", "🔖", "🧷", "🔗", "📎", "🖇️", "📐", "📏", "🧮", "📌", "📍", "✂️", "🖊️", "🖋️", "✒️", "🖌️", "🖍️", "📝", "✏️", "🔍", "🔎", "🔏", "🔐", "🔒", "🔓"],
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

// --- Chat wallpaper (per phone, localStorage) ---

const WALLPAPER_KEY = "lovechat.wallpaper";
const WALLPAPERS: Record<
  string,
  { label: string; style: React.CSSProperties; darkStyle: React.CSSProperties }
> = {
  default: { label: "Default dots", style: {}, darkStyle: {} },
  ocean: {
    label: "Ocean mist",
    style: { background: "linear-gradient(180deg, #D8ECF6 0%, #EAF2F8 100%)" },
    darkStyle: {
      background: "linear-gradient(180deg, #0f1f2e 0%, #0e1621 100%)",
    },
  },
  sunset: {
    label: "Sunset glow",
    style: { background: "linear-gradient(180deg, #FBE0C8 0%, #FDF3E7 100%)" },
    darkStyle: {
      background: "linear-gradient(180deg, #2b1a12 0%, #1a120c 100%)",
    },
  },
  mint: {
    label: "Mint leaf",
    style: { background: "linear-gradient(180deg, #D7EEE0 0%, #EAF6EE 100%)" },
    darkStyle: {
      background: "linear-gradient(180deg, #12211a 0%, #0e1621 100%)",
    },
  },
  lavender: {
    label: "Lavender",
    style: { background: "linear-gradient(180deg, #E5DEF7 0%, #F3F0FB 100%)" },
    darkStyle: {
      background: "linear-gradient(180deg, #1d1830 0%, #14101f 100%)",
    },
  },
  rose: {
    label: "Rose petal",
    style: { background: "linear-gradient(180deg, #F9DCE2 0%, #FDF0F2 100%)" },
    darkStyle: {
      background: "linear-gradient(180deg, #2a1219 0%, #1c0e12 100%)",
    },
  },
};

function loadWallpaper(): string {
  try {
    const raw = localStorage.getItem(WALLPAPER_KEY);
    if (raw && WALLPAPERS[raw]) return raw;
  } catch {
    // fall through to default
  }
  return "default";
}

// --- Theme: Light (Ice Blue / Ocean) or Dark (Telegram dark + pink) ---

const THEME_KEY = "lovechat.theme";
type Theme = "light" | "dark";

function loadTheme(): Theme {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === "light" || raw === "dark") return raw;
  } catch {
    // fall through to the default
  }
  // Light is the default look (the dark theme is still available in
  // Settings for anyone who wants it).
  return "light";
}

// --- Recently used emojis for the picker (localStorage, max 12) ---

const RECENT_EMOJIS_KEY = "lovechat.recent_emojis";

function loadRecentEmojis(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_EMOJIS_KEY);
    if (raw) {
      return (JSON.parse(raw) as unknown[])
        .filter((e): e is string => typeof e === "string")
        .slice(0, 12);
    }
  } catch {
    // fall through to empty
  }
  return [];
}

// --- Online / last-seen presence ---

// The other phone counts as Online when its heartbeat is < 20s old
// (the app posts one every 10s while open).
function isOnline(iso: string | null): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 20_000;
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return "";
  if (isOnline(iso)) return "Online";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Yangon",
  });
  if (sameDay(d, now)) return `Last seen ${time}`;
  if (sameDay(d, yesterday)) return `Last seen yesterday ${time}`;
  return `Last seen ${d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Yangon",
  })} ${time}`;
}

// Read ticks (✓ / ✓✓) as Lucide icons instead of text.
function Ticks({ read }: { read: boolean }) {
  return read ? (
    <CheckCheck className="inline h-3.5 w-3.5" />
  ) : (
    <Check className="inline h-3.5 w-3.5" />
  );
}

// Live Together counter: days + ticking HH:MM:SS since the date.
function formatTogether(since: string, nowMs: number): string {
  const start = new Date(`${since}T00:00:00`).getTime();
  const diff = Math.max(0, nowMs - start);
  const days = Math.floor(diff / 86_400_000);
  const rest = diff % 86_400_000;
  const h = Math.floor(rest / 3_600_000);
  const m = Math.floor((rest % 3_600_000) / 60_000);
  const s = Math.floor((rest % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${days} day${days === 1 ? "" : "s"} • ${pad(h)}:${pad(m)}:${pad(s)}`;
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
  // Confirming an identity reset in Settings.
  const [confirmResetIdentity, setConfirmResetIdentity] = useState(false);
  // Message being edited (own text message only) — the composer turns
  // into an edit box with an "Editing message" bar above it.
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  // Presence: each phone heartbeats every 10s; the header shows the
  // other phone as Online / Last seen.
  const [presence, setPresence] = useState<Record<Sender, string | null>>({
    kaung: null,
    love: null,
  });
  // Chat wallpaper (per phone, localStorage).
  const [wallpaper, setWallpaper] = useState("default");
  // Theme: Light or Telegram-style Dark (per phone, localStorage).
  const [theme, setTheme] = useState<Theme>("light");
  // Recently used emojis for the picker.
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  // Profile photos (both phones, data URLs) — fetched once on load.
  const [photos, setPhotos] = useState<Record<Sender, string | null>>({
    kaung: null,
    love: null,
  });
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  // Chat photos: cached data URLs by message id (fetched lazily on
  // tap, like voice audio), plus the fullscreen lightbox.
  const [photoUrls, setPhotoUrls] = useState<Record<number, string>>({});
  const [loadingPhotoId, setLoadingPhotoId] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [photoSending, setPhotoSending] = useState(false);
  const photoCacheRef = useRef(new Map<number, string>());
  const chatPhotoInputRef = useRef<HTMLInputElement | null>(null);
  // Together counter: the date both phones share, and a 1s ticker
  // that makes the counter live.
  const [togetherSince, setTogetherSince] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  // Voice messages: tap the mic to record, tap stop, then send.
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [voicePreview, setVoicePreview] = useState<{
    url: string;
    base64: string;
    seconds: number;
    mime: string;
  } | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<number | null>(null);
  // Scroll-to-bottom button (Telegram-style): shown when the user has
  // scrolled up; the badge counts new messages that arrived meanwhile.
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [newWhileAway, setNewWhileAway] = useState(0);
  // Tiny transient toast (e.g. "Copied").
  const [toast, setToast] = useState("");
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
  // Voice recording refs (native plugin — see startRecording).
  const recTimerRef = useRef<number | null>(null);
  const recStartedAtRef = useRef(0);
  const discardVoiceRef = useRef(false);
  const recordingRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const toastTimerRef = useRef<number | null>(null);
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
    setWallpaper(loadWallpaper());
    setTheme(loadTheme());
    setRecentEmojis(loadRecentEmojis());
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

  function showToast(text: string) {
    setToast(text);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 1500);
  }

  // Apply the theme to <html> so every theme colour swaps at once
  // (all utilities read the theme variables).
  useEffect(() => {
    document.documentElement.classList.toggle("theme-dark", theme === "dark");
  }, [theme]);

  // Keep a ref mirror of the messages for the poll, whose callback
  // must not close over stale state.
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/messages", { cache: "no-store" });
      if (!res.ok) throw new Error("load failed");
      const data = (await res.json()) as {
        messages: ChatMessage[];
        typing: { sender: Sender } | null;
        presence?: Record<Sender, string | null>;
      };
      setConnected(true);
      setLoadError("");
      if (data.presence) setPresence(data.presence);
      const me = identityRef.current;
      // Are we near the bottom, and did any new messages from the
      // other person arrive while we were scrolled up?
      const el = listRef.current;
      const nearBottom = el
        ? el.scrollHeight - el.scrollTop - el.clientHeight < 160
        : true;
      const prevMaxId = messagesRef.current.reduce(
        (max, m) => Math.max(max, m.id),
        0,
      );
      const freshIncoming = data.messages.filter(
        (m) => m.id > prevMaxId && me && m.sender !== me,
      ).length;
      if (!nearBottom && freshIncoming > 0) {
        setNewWhileAway((n) => n + freshIncoming);
      }
      setMessages((prev) => {
        const changed =
          prev.length !== data.messages.length ||
          prev.some(
            (m, i) =>
              m.id !== data.messages[i]?.id ||
              m.body !== data.messages[i]?.body ||
              m.edited_at !== data.messages[i]?.edited_at ||
              m.reply_to_id !== data.messages[i]?.reply_to_id ||
              JSON.stringify(m.reactions) !==
                JSON.stringify(data.messages[i]?.reactions),
          );
        if (!changed) return prev;
        // Auto-scroll only if we were already near the bottom —
        // never yank the user away from the history they are reading.
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

  // Presence heartbeat: tell the other phone we're here, every 10s
  // while the app is open (also when it comes back to the front).
  useEffect(() => {
    if (!identity) return;
    const beat = () => {
      void fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: identity }),
      }).catch(() => {});
    };
    beat();
    const t = window.setInterval(beat, 10_000);
    const onVisible = () => {
      if (!document.hidden) beat();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [identity]);

  // Profile photos: fetch both once when the app opens (never in the
  // 1.5s poll — there is no need to re-fetch them).
  useEffect(() => {
    if (!identity) return;
    void (async () => {
      try {
        const res = await fetch("/api/profile-photo", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          photos: Record<Sender, string | null>;
        };
        setPhotos({
          kaung: data.photos.kaung
            ? `data:image/jpeg;base64,${data.photos.kaung}`
            : null,
          love: data.photos.love
            ? `data:image/jpeg;base64,${data.photos.love}`
            : null,
        });
      } catch {
        // Photos stay as Heart-icon fallbacks.
      }
    })();
  }, [identity]);

  // Together date: shared by both phones, fetched once on open.
  useEffect(() => {
    if (!identity) return;
    void (async () => {
      try {
        const res = await fetch("/api/together", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { date: string | null };
        setTogetherSince(data.date);
      } catch {
        // No counter until a date is set in Settings.
      }
    })();
  }, [identity]);

  // Tick the Together counter once a second (only while a date is
  // set — the message list is memoized, so this re-render is cheap).
  useEffect(() => {
    if (!togetherSince) return;
    const t = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [togetherSince]);

  // Grow the composer with the text (Telegram-style), up to ~5 lines.
  // Runs after every keystroke and after send clears the input.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [input]);

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
                // Double-tap a bubble for a quick ❤️ (Telegram-style).
                onDoubleClick={() => void reactTo(m.id, "❤️")}
              >
                <div
                  className={`relative max-w-[78%] rounded-2xl px-3.5 py-2 shadow-sm select-none ${
                    own
                      ? "rounded-br-md bg-bubble-own text-white"
                      : "rounded-bl-md bg-card text-ink"
                  }`}
                >
                  {/* Telegram-style tail */}
                  <span
                    aria-hidden
                    className={`absolute bottom-0 h-3 w-3 rotate-45 ${
                      own ? "-right-1 bg-bubble-own" : "-left-1 bg-card"
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
                          own ? "text-own-soft" : "text-ocean"
                        }`}
                      >
                        {displayName(m.reply_to.sender, names)}
                      </span>
                      <span
                        className={`block truncate text-xs ${
                          own ? "text-own-soft" : "text-ink-soft"
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
                          {loadingAudioId === m.id ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : playingId === m.id ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
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
                            own ? "text-own-soft" : "text-ink-soft"
                          }`}
                        >
                          {formatVoiceTime(m.audio_duration ?? 0)}
                        </span>
                      </div>
                      <p
                        className={`mt-1 text-right text-[11px] ${
                          own ? "text-own-soft" : "text-ink-soft"
                        }`}
                      >
                        {formatTime(m.created_at)}
                        {own && (
                          <span className="ml-1">
                            <Ticks read={!!m.read_at} />
                          </span>
                        )}
                      </p>
                    </div>
                  ) : m.kind === "photo" && m.has_photo ? (
                    <div>
                      {photoUrls[m.id] ? (
                        <button
                          type="button"
                          onClick={() => setLightbox(photoUrls[m.id])}
                          className="block overflow-hidden rounded-xl"
                        >
                          <img
                            src={photoUrls[m.id]}
                            alt="Photo"
                            className="block max-h-72 w-full object-cover"
                          />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void loadPhoto(m.id)}
                          disabled={loadingPhotoId === m.id}
                          className={`flex w-48 flex-col items-center justify-center gap-1 rounded-xl py-8 text-sm font-semibold ${
                            own ? "bg-white/20 text-white" : "bg-ice text-ocean"
                          }`}
                        >
                          <Camera className="h-9 w-9" />
                          {loadingPhotoId === m.id
                            ? "Loading…"
                            : "Tap to view photo"}
                        </button>
                      )}
                      <p
                        className={`mt-1 text-right text-[11px] ${
                          own ? "text-own-soft" : "text-ink-soft"
                        }`}
                      >
                        {formatTime(m.created_at)}
                        {own && (
                          <span className="ml-1">
                            <Ticks read={!!m.read_at} />
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
                          own ? "text-own-soft" : "text-ink-soft"
                        }`}
                      >
                        {formatTime(m.created_at)}
                        {m.edited_at ? " · edited" : ""}
                        {own && (
                          <span className="ml-1">
                            <Ticks read={!!m.read_at} />
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
  }, [messages, identity, names, typingFrom, playingId, loadingAudioId, photoUrls, loadingPhotoId]);

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

  // Identity lock: a phone's identity is picked once (first open) and
  // cannot be switched in Settings — otherwise either phone could
  // impersonate the other person (and mis-route push notifications).
  // Resetting clears the saved identity and shows the first-open
  // picker again; push re-registers under the new identity because
  // the registration effect depends on `identity`.
  function resetIdentity() {
    localStorage.removeItem(IDENTITY_KEY);
    setIdentity(null);
    setShowSettings(false);
    setConfirmResetIdentity(false);
  }

  function saveNames() {
    const cleaned: Names = {
      kaung: draftNames.kaung.trim() || DEFAULT_DISPLAY_NAMES.kaung,
      love: draftNames.love.trim() || DEFAULT_DISPLAY_NAMES.love,
    };
    localStorage.setItem(NAMES_KEY, JSON.stringify(cleaned));
    setNames(cleaned);
    setShowSettings(false);
    setConfirmResetIdentity(false);
  }

  // --- Profile photo (one per person, stored server-side) ---

  // Compress a picked image to a max dimension JPEG. Profile photos
  // use 256px / 0.85 (~20–50 KB); chat photos use 1200px / 0.82
  // (~150–400 KB).
  async function compressImage(
    file: File,
    maxSize: number,
    quality: number,
  ): Promise<{ base64: string; width: number; height: number } | null> {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error("bad image"));
        im.src = url;
      });
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const base64 = dataUrl.split(",")[1] ?? null;
      if (!base64) return null;
      return { base64, width: w, height: h };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function onPhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !identity) return;
    setPhotoUploading(true);
    try {
      const compressed = await compressImage(file, 256, 0.85);
      if (!compressed) throw new Error("compress failed");
      const res = await fetch("/api/profile-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: identity, photoBase64: compressed.base64 }),
      });
      if (!res.ok) throw new Error("upload failed");
      setPhotos((prev) => ({
        ...prev,
        [identity]: `data:image/jpeg;base64,${compressed.base64}`,
      }));
      showToast("Profile photo updated");
    } catch {
      showToast("Couldn't upload photo");
    } finally {
      setPhotoUploading(false);
    }
  }

  async function removePhoto() {
    if (!identity) return;
    setPhotoUploading(true);
    try {
      const res = await fetch("/api/profile-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: identity, photoBase64: null }),
      });
      if (!res.ok) throw new Error("remove failed");
      setPhotos((prev) => ({ ...prev, [identity]: null }));
      showToast("Profile photo removed");
    } catch {
      showToast("Couldn't remove photo");
    } finally {
      setPhotoUploading(false);
    }
  }

  // --- Chat photos (send a photo as a message) ---

  async function onChatPhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !identity || photoSending) return;
    setPhotoSending(true);
    let optimisticId = 0;
    try {
      const compressed = await compressImage(file, 1200, 0.82);
      if (!compressed) throw new Error("compress failed");
      const dataUrl = `data:image/jpeg;base64,${compressed.base64}`;
      const replyingTo = replyTo;
      setReplyTo(null);
      const optimistic: ChatMessage = {
        id: -Date.now(),
        sender: identity,
        body: "📷 Photo",
        kind: "photo",
        created_at: new Date().toISOString(),
        read_at: null,
        reply_to_id: replyingTo?.id ?? null,
        reply_to: replyingTo
          ? {
              id: replyingTo.id,
              sender: replyingTo.sender,
              body: replyingTo.body,
            }
          : null,
        reactions: [],
        audio_duration: null,
        audio_mime: null,
        has_audio: false,
        edited_at: null,
        photo_width: compressed.width,
        photo_height: compressed.height,
        has_photo: true,
      };
      optimisticId = optimistic.id;
      photoCacheRef.current.set(optimistic.id, dataUrl);
      setPhotoUrls((prev) => ({ ...prev, [optimistic.id]: dataUrl }));
      setMessages((prev) => [...prev, optimistic]);
      requestAnimationFrame(() => scrollToBottom());
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: identity,
          kind: "photo",
          photoBase64: compressed.base64,
          photoWidth: compressed.width,
          photoHeight: compressed.height,
          replyToId: replyingTo?.id ?? null,
        }),
      });
      if (!res.ok) throw new Error("send failed");
      const data = (await res.json()) as { message: ChatMessage };
      // Move the cached image from the optimistic id to the real id.
      photoCacheRef.current.set(data.message.id, dataUrl);
      setPhotoUrls((prev) => {
        const next = { ...prev, [data.message.id]: dataUrl };
        delete next[optimistic.id];
        return next;
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? data.message : m)),
      );
      await fetchState();
    } catch {
      showToast("Couldn't send photo");
      if (optimisticId) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      }
    } finally {
      setPhotoSending(false);
    }
  }

  // Load a photo message's image on tap (cached afterwards).
  async function loadPhoto(id: number) {
    const cached = photoCacheRef.current.get(id);
    if (cached) {
      setPhotoUrls((prev) => ({ ...prev, [id]: cached }));
      return;
    }
    setLoadingPhotoId(id);
    try {
      const res = await fetch(`/api/photo?id=${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("load failed");
      const data = (await res.json()) as { photoBase64: string };
      const dataUrl = `data:image/jpeg;base64,${data.photoBase64}`;
      photoCacheRef.current.set(id, dataUrl);
      setPhotoUrls((prev) => ({ ...prev, [id]: dataUrl }));
    } catch {
      showToast("Couldn't load photo");
    } finally {
      setLoadingPhotoId((cur) => (cur === id ? null : cur));
    }
  }

  // --- Together date (shared by both phones) ---

  async function saveTogetherDate(date: string) {
    setTogetherSince(date || null);
    try {
      const res = await fetch("/api/together", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: date || null }),
      });
      if (!res.ok) throw new Error("save failed");
      showToast(date ? "Together date saved" : "Together date cleared");
    } catch {
      showToast("Couldn't save date");
    }
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
    // Remember recently used emojis for the picker's Recent row.
    setRecentEmojis((prev) => {
      const nextList = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, 12);
      try {
        localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(nextList));
      } catch {
        // Storage unavailable — the row just won't persist.
      }
      return nextList;
    });
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
    // Editing mode: the send button saves the edit instead of
    // sending a new message.
    if (editing) {
      await saveEdit();
      return;
    }
    const body = input.trim();
    if (!body || !identity || sending) return;
    ensureAudio();
    setSending(true);
    setInput("");
    cursorRef.current = null;
    setShowEmoji(false);
    // Keep the keyboard open like Telegram: tapping the send button
    // steals focus from the composer (and the keyboard with it), so
    // put focus straight back — once now, inside the tap gesture, and
    // once more when the send finishes, in case it dismissed meanwhile.
    inputRef.current?.focus();
    try {
      navigator.vibrate?.(10);
    } catch {
      // Vibration unsupported — ignore.
    }
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
      edited_at: null,
      photo_width: null,
      photo_height: null,
      has_photo: false,
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
      inputRef.current?.focus();
    }
  }

  // --- Editing your own text message (no delete) ---

  function startEdit(m: ChatMessage) {
    if (!identity || m.sender !== identity || m.kind !== "text") return;
    setEditing(m);
    setReplyTo(null);
    setShowEmoji(false);
    setInput(m.body);
    cursorRef.current = { start: m.body.length, end: m.body.length };
    const el = inputRef.current;
    if (el) {
      el.focus();
      requestAnimationFrame(() =>
        el.setSelectionRange(m.body.length, m.body.length),
      );
    }
  }

  function cancelEdit() {
    setEditing(null);
    setInput("");
    cursorRef.current = null;
  }

  async function saveEdit() {
    const body = input.trim();
    if (!body || !editing || !identity || sending) return;
    const target = editing;
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: target.id, sender: identity, body }),
      });
      if (!res.ok) throw new Error("edit failed");
      const data = (await res.json()) as { message: ChatMessage };
      setMessages((prev) =>
        prev.map((m) => (m.id === target.id ? data.message : m)),
      );
      setEditing(null);
      setInput("");
      cursorRef.current = null;
      inputRef.current?.focus();
    } catch {
      showToast("Couldn't edit — try again");
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

  // --- Voice messages (native recorder) ---
  //
  // Recording uses the capacitor-voice-recorder plugin, NOT the WebView's
  // getUserMedia/MediaRecorder. The WebView path works in a browser but
  // fails in the app: even with Microphone ALLOWED in Settings it threw
  // NotAllowedError (the WebView permission flow via Capacitor's
  // onPermissionRequest is unreliable on this phone — it worked once,
  // then kept denying). The plugin records natively with Android's
  // MediaRecorder (AAC) and asks for the permission itself, so it
  // bypasses the WebView entirely. On a plain browser the plugin falls
  // back to its own MediaRecorder implementation.
  const MAX_VOICE_SECONDS = 120;

  // Stop the timer and, if a recording is in progress, stop the native
  // recorder (also used as an unmount cleanup).
  async function stopVoiceCapture() {
    if (recTimerRef.current) window.clearInterval(recTimerRef.current);
    recTimerRef.current = null;
    if (recordingRef.current) {
      recordingRef.current = false;
      setIsRecording(false);
      discardVoiceRef.current = true;
      try {
        await VoiceRecorder.stopRecording();
      } catch {
        // Nothing to stop (already stopped) — safe to ignore.
      }
    }
  }

  // Release the mic if this screen ever unmounts mid-recording.
  useEffect(() => () => void stopVoiceCapture(), []);

  async function startRecording() {
    setVoiceError("");
    setVoicePreview(null);
    try {
      const canRecord = await VoiceRecorder.canDeviceVoiceRecord();
      if (!canRecord.value) {
        setVoiceError("This phone can't record voice messages.");
        return;
      }
      const has = await VoiceRecorder.hasAudioRecordingPermission();
      if (!has.value) {
        const req = await VoiceRecorder.requestAudioRecordingPermission();
        if (!req.value) {
          setVoiceError(
            "Mic permission is off — allow Microphone for We Talk in Settings, then tap the mic again.",
          );
          return;
        }
      }
      const started = await VoiceRecorder.startRecording();
      if (!started.value) {
        setVoiceError("Couldn't start recording — try again.");
        return;
      }
      recStartedAtRef.current = Date.now();
      recordingRef.current = true;
      setRecSeconds(0);
      setIsRecording(true);
      recTimerRef.current = window.setInterval(() => {
        const s = Math.floor((Date.now() - recStartedAtRef.current) / 1000);
        setRecSeconds(s);
        if (s >= MAX_VOICE_SECONDS) void stopRecording();
      }, 500);
    } catch (e) {
      // Show the REAL error instead of a generic message, so a failure
      // is diagnosable.
      const err = e as Error | undefined;
      setVoiceError(
        `Mic error (${err?.name ?? "unknown"}): ${err?.message ?? "could not start recording"}`,
      );
    }
  }

  async function stopRecording() {
    if (!recordingRef.current) return;
    if (recTimerRef.current) window.clearInterval(recTimerRef.current);
    recTimerRef.current = null;
    recordingRef.current = false;
    setIsRecording(false);
    const discard = discardVoiceRef.current;
    discardVoiceRef.current = false;
    try {
      const result = await VoiceRecorder.stopRecording();
      if (discard) return;
      const base64 = result.value.recordDataBase64;
      if (!base64) {
        setVoiceError("Recording came back empty — try again.");
        return;
      }
      const mime = result.value.mimeType || "audio/aac";
      const seconds = Math.max(1, Math.round(result.value.msDuration / 1000));
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: mime });
      setVoicePreview({
        url: URL.createObjectURL(blob),
        base64,
        seconds,
        mime,
      });
    } catch (e) {
      const err = e as Error | undefined;
      setVoiceError(
        `Mic error (${err?.name ?? "unknown"}): ${err?.message ?? "could not stop recording"}`,
      );
    }
  }

  function cancelRecording() {
    discardVoiceRef.current = true;
    void stopRecording();
    setVoicePreview(null);
    setRecSeconds(0);
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
      edited_at: null,
      photo_width: null,
      photo_height: null,
      has_photo: false,
    };
    setMessages((prev) => [...prev, optimistic]);
    requestAnimationFrame(() => scrollToBottom());
    try {
      navigator.vibrate?.(10);
    } catch {
      // Vibration unsupported — ignore.
    }
    try {
      // The native recorder already returns base64 — no conversion needed.
      const base64 = preview.base64;
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
        <p className="flex items-center gap-1.5 text-ink-soft">
          Loading… <Heart className="h-4 w-4 fill-current text-ocean" />
        </p>
      </div>
    );
  }

  // First-open identity picker: each phone picks who is using it.
  if (!identity) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-ice px-6 text-center">
        <div className="fade-up flex w-full max-w-sm flex-col items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-ocean shadow-lg">
            <Heart className="h-9 w-9 fill-white text-white" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-ink">We Talk</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Our private little chat{" "}
            <Heart className="inline h-3.5 w-3.5 fill-current text-ocean" />
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
  const otherPhoto = photos[other];
  const myPhoto = photos[me];
  const lastOwnRead = [...messages].reverse().find((m) => m.sender === me);

  return (
    <div
      className="mx-auto flex h-dvh w-full max-w-2xl flex-col bg-ice sm:border-x sm:border-line"
      style={viewportHeight ? { height: viewportHeight } : undefined}
    >
      {/* Header — Telegram-style floating rounded bar, edges aligned
          with the message column (mx-4 = the list's px-4). */}
      <header className="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-xl">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ocean text-xl text-white">
          {otherPhoto ? (
            <img
              src={otherPhoto}
              alt=""
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <Heart className="h-5 w-5 fill-white text-white" />
          )}
          <span
            className={`absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${
              isOnline(presence[other]) ? "bg-green-500" : "bg-gray-400"
            }`}
            title={isOnline(presence[other]) ? "Online" : "Offline"}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold text-ink">
            {displayName("kaung", names)} &amp; {displayName("love", names)}
          </h1>
          <p
            className={`truncate text-xs ${
              typingFrom
                ? "text-ocean"
                : isOnline(presence[other])
                  ? "text-green-600"
                  : "text-ink-soft"
            }`}
          >
            {typingFrom
              ? `${displayName(typingFrom, names)} is typing…`
              : formatLastSeen(presence[other]) ||
                (connected
                  ? `Chatting with ${displayName(other, names)}`
                  : "Offline — reconnecting…")}
          </p>
        </div>
        <button
          onClick={() => {
            setDraftNames({ ...names });
            setShowSettings(true);
          }}
          className="flex items-center rounded-full bg-ice-deep px-3 py-2 text-sm font-semibold text-ocean transition active:scale-95"
          aria-label="Settings"
        >
          <Settings className="mr-1.5 h-4 w-4" /> {displayName(me, names)}
        </button>
      </header>

      {/* Live Together counter (pinned-style bar under the header).
          Tap it to change the date in Settings. */}
      {togetherSince && (
        <button
          type="button"
          onClick={() => {
            setDraftNames({ ...names });
            setShowSettings(true);
          }}
          className="mx-4 mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-card px-4 py-1.5 text-xs font-semibold text-ocean shadow-md"
        >
          <Heart className="h-3.5 w-3.5 fill-current" /> Together{" "}
          {formatTogether(togetherSince, nowTick)}
        </button>
      )}

      {/* Messages */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={listRef}
          className="chat-bg flex-1 overflow-y-auto px-4 py-4"
          style={
            wallpaper === "default"
              ? undefined
              : theme === "dark"
                ? WALLPAPERS[wallpaper]?.darkStyle
                : WALLPAPERS[wallpaper]?.style
          }
          onClick={() => {
            if (showSettings) setShowSettings(false);
            if (showEmoji) setShowEmoji(false);
          }}
          onScroll={() => {
            const el = listRef.current;
            if (!el) return;
            const nearBottom =
              el.scrollHeight - el.scrollTop - el.clientHeight < 160;
            setShowScrollDown(!nearBottom);
            if (nearBottom) setNewWhileAway(0);
          }}
        >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Heart className="h-12 w-12 fill-ocean text-ocean" />
            <p className="mt-4 text-lg font-bold text-ink">Hello</p>
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
        {/* Scroll-to-bottom button (Telegram-style) with a badge for
            new messages that arrived while scrolled up. */}
        {showScrollDown && (
          <button
            type="button"
            onClick={() => {
              setNewWhileAway(0);
              setShowScrollDown(false);
              scrollToBottom();
            }}
            className="absolute right-4 bottom-4 flex h-11 w-11 items-center justify-center rounded-full bg-card text-xl text-ocean shadow-lg transition active:scale-95"
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="h-6 w-6" />
            {newWhileAway > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                {newWhileAway > 99 ? "99+" : newWhileAway}
              </span>
            )}
          </button>
        )}
      </div>

      {loadError && (
        <p className="bg-card px-4 py-1.5 text-center text-xs text-red-600">
          {loadError}
        </p>
      )}

      {/* Read receipt hint for own last message */}
      {lastOwnRead?.read_at && (
        <p className="bg-ice px-4 pb-1 text-right text-[11px] text-ink-soft">
          {displayName(other, names)} read this{" "}
          <CheckCheck className="inline h-3.5 w-3.5" />
        </p>
      )}

      {/* Transient toast (e.g. "Copied") */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center">
          <span className="rounded-full bg-black/80 px-4 py-2 text-sm font-semibold text-white shadow-lg">
            {toast}
          </span>
        </div>
      )}

      {/* Fullscreen photo viewer (tap a photo, tap anywhere to close) */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Photo"
            className="max-h-full max-w-full rounded-xl object-contain"
          />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 rounded-full bg-white/20 px-3 py-2 text-sm font-bold text-white"
            aria-label="Close photo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Composer — Telegram-style floating rounded bar, edges aligned
          with the message column (mx-4 = the list's px-4). */}
      <div className="mx-4 mb-[max(0.75rem,env(safe-area-inset-bottom))] rounded-3xl bg-card px-3 py-2 shadow-lg">
        {editing && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border-l-4 border-amber-500 bg-ice px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-amber-600">
                Editing message
              </p>
              <p className="truncate text-xs text-ink-soft">{editing.body}</p>
            </div>
            <button
              type="button"
              onClick={cancelEdit}
              className="shrink-0 rounded-full px-2 py-1 text-ink-soft"
              aria-label="Cancel edit"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
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
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {showEmoji && (
          <div className="mb-2 rounded-2xl border border-line bg-ice p-2 shadow-sm">
            {recentEmojis.length > 0 && (
              <div className="mb-1">
                <p className="px-1 pb-1 text-[11px] font-bold text-ink-soft">
                  Recent
                </p>
                <div className="flex flex-wrap gap-0.5">
                  {recentEmojis.map((e) => (
                    <button
                      key={e}
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => insertEmoji(e)}
                      className="rounded-lg px-1 py-1 text-xl transition active:scale-125"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-1">
              {EMOJI_GROUPS.map((g, i) => (
                <button
                  key={g.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setEmojiTab(i)}
                  className={`flex flex-1 items-center justify-center rounded-xl py-1.5 ${
                    emojiTab === i ? "bg-ice-deep" : ""
                  }`}
                  aria-label={g.label}
                >
                  <g.icon className="h-5 w-5" />
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
              <X className="mr-1 inline h-4 w-4" /> Cancel
            </button>
            <button
              type="button"
              onClick={stopRecording}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500 text-lg text-white shadow-md transition active:scale-95"
              aria-label="Stop recording"
            >
              <Square className="h-5 w-5 fill-current" />
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
              {previewPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
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
              <X className="mr-1 inline h-4 w-4" /> Cancel
            </button>
            <button
              type="button"
              onClick={() => void sendVoice()}
              disabled={sending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ocean text-lg text-white shadow-md transition active:scale-95 disabled:opacity-40"
              aria-label="Send voice message"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => chatPhotoInputRef.current?.click()}
              disabled={photoSending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ice-deep text-xl text-ocean transition active:scale-95 disabled:opacity-40"
              aria-label="Send a photo"
            >
              <Camera className="h-5 w-5" />
            </button>
            <input
              ref={chatPhotoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onChatPhotoFile(e)}
            />
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
              <Smile className="h-5 w-5" />
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
                // Tapping the text field closes the emoji panel
                // (Telegram behavior) and opens the keyboard.
                setShowEmoji(false);
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
                aria-label={editing ? "Save edit" : "Send"}
              >
                {editing ? <Check className="h-5 w-5" /> : <Send className="h-5 w-5" />}
              </button>
            ) : (
              <button
                onClick={() => void startRecording()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ocean text-lg text-white shadow-md transition active:scale-95"
                aria-label="Record voice message"
              >
                <Mic className="h-5 w-5" />
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
              className="mt-3 flex w-full items-center justify-center rounded-xl bg-ice-deep px-4 py-3 text-sm font-bold text-ocean"
            >
              <Reply className="mr-1.5 h-4 w-4" /> Reply to this message
            </button>
            {reactMenuFor.kind === "text" && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(reactMenuFor.body);
                    showToast("Copied");
                  } catch {
                    showToast("Couldn't copy");
                  }
                  setReactMenuFor(null);
                }}
                className="mt-2 flex w-full items-center justify-center rounded-xl bg-ice-deep px-4 py-3 text-sm font-bold text-ocean"
              >
                <Copy className="mr-1.5 h-4 w-4" /> Copy text
              </button>
            )}
            {reactMenuFor.sender === identity &&
              reactMenuFor.kind === "text" && (
                <button
                  type="button"
                  onClick={() => {
                    startEdit(reactMenuFor);
                    setReactMenuFor(null);
                  }}
                  className="mt-2 flex w-full items-center justify-center rounded-xl bg-ice-deep px-4 py-3 text-sm font-bold text-ocean"
                >
                  <Pencil className="mr-1.5 h-4 w-4" /> Edit message
                </button>
              )}
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
              This phone is
            </p>
            <div className="mt-2 flex items-center justify-between rounded-xl bg-ice px-3 py-3">
              <span className="flex items-center gap-1 text-sm font-bold text-ink">
                {displayName(me, names)} (
                {me === "kaung" ? "Person 1" : "Person 2"}){" "}
                <Lock className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs text-ink-soft">
                Locked to this phone
              </span>
            </div>
            {!confirmResetIdentity ? (
              <button
                type="button"
                onClick={() => setConfirmResetIdentity(true)}
                className="mt-2 w-full rounded-xl px-4 py-2 text-sm font-semibold text-ink-soft"
              >
                Reset identity…
              </button>
            ) : (
              <div className="mt-2 rounded-xl border border-line bg-ice p-3">
                <p className="text-sm text-ink">
                  This phone will ask who is using it again. Are you sure?
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmResetIdentity(false)}
                    className="flex-1 rounded-xl bg-ice-deep px-4 py-2 text-sm font-bold text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={resetIdentity}
                    className="flex-1 rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white"
                  >
                    Yes, reset
                  </button>
                </div>
              </div>
            )}
            {/* Profile photo (mine — shown on the other phone's header) */}
            <p className="mt-5 text-sm font-semibold text-ink-soft">
              My profile photo
            </p>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ocean text-2xl text-white">
                {myPhoto ? (
                  <img
                    src={myPhoto}
                    alt="My profile photo"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Heart className="h-6 w-6 fill-white text-white" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <button
                  type="button"
                  disabled={photoUploading}
                  onClick={() => photoInputRef.current?.click()}
                  className="rounded-xl bg-ice-deep px-4 py-2.5 text-sm font-bold text-ocean disabled:opacity-50"
                >
                  {photoUploading
                    ? "Uploading…"
                    : myPhoto
                      ? "Change photo"
                      : "Upload a photo"}
                </button>
                {myPhoto && (
                  <button
                    type="button"
                    disabled={photoUploading}
                    onClick={() => void removePhoto()}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                  >
                    Remove photo
                  </button>
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void onPhotoFile(e)}
              />
            </div>
            {/* Theme: Light or Telegram-style Dark */}
            <p className="mt-5 text-sm font-semibold text-ink-soft">Theme</p>
            <div className="mt-2 flex gap-2">
              {(["light", "dark"] as Theme[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTheme(t);
                    try {
                      localStorage.setItem(THEME_KEY, t);
                    } catch {
                      // Storage unavailable — the choice just won't persist.
                    }
                  }}
                  className={`flex flex-1 items-center justify-center rounded-xl px-3 py-3 text-sm font-bold ${
                    theme === t
                      ? "bg-ocean text-white"
                      : "bg-ice-deep text-ocean"
                  }`}
                >
                  {t === "light" ? (
                    <Sun className="mr-1.5 h-4 w-4" />
                  ) : (
                    <Moon className="mr-1.5 h-4 w-4" />
                  )}
                  {t === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
            {/* Chat wallpaper (per phone) */}
            <p className="mt-5 text-sm font-semibold text-ink-soft">
              Chat wallpaper
            </p>
            <div className="mt-2 grid grid-cols-6 gap-2">
              {Object.entries(WALLPAPERS).map(([id, w]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setWallpaper(id);
                    try {
                      localStorage.setItem(WALLPAPER_KEY, id);
                    } catch {
                      // Storage unavailable — the choice just won't persist.
                    }
                  }}
                  className={`flex h-10 items-center justify-center rounded-xl border-2 text-xs font-bold ${
                    wallpaper === id ? "border-ocean" : "border-transparent"
                  } ${id === "default" ? "chat-bg" : ""}`}
                  style={
                    id === "default"
                      ? undefined
                      : theme === "dark"
                        ? w.darkStyle
                        : w.style
                  }
                  aria-label={w.label}
                  title={w.label}
                >
                  {id === "default" ? "✿" : ""}
                </button>
              ))}
            </div>
            {/* Together date (shared by both phones) */}
            <label className="mt-5 block text-sm font-semibold text-ink-soft">
              Together since
              <input
                type="date"
                value={togetherSince ?? ""}
                onChange={(e) => void saveTogetherDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-ice px-3 py-2.5 text-ink outline-none focus:border-ocean"
              />
            </label>
            <p className="mt-1 text-xs text-ink-soft">
              Shows a live day + time counter under the header. Tap the
              counter to change the date.
            </p>
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
                onClick={() => {
                  setShowSettings(false);
                  setConfirmResetIdentity(false);
                }}
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
