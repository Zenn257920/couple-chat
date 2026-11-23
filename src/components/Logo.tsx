// The We Talk W logo as inline SVG — the app icon (assets/icon.png)
// is a PNG in assets/, which is not served, so the logo is drawn
// here instead: glossy blue rounded square, white W, small chat
// bubble with a heart at the bottom right.
export default function Logo({ className = "h-20 w-20" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="We Talk logo"
    >
      <defs>
        <linearGradient id="we-talk-w" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b9bd5" />
          <stop offset="0.55" stopColor="#2f6db3" />
          <stop offset="1" stopColor="#174a7c" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="112" height="112" rx="28" fill="url(#we-talk-w)" />
      <path
        d="M30 40 L42 80 L60 52 L78 80 L90 40"
        fill="none"
        stroke="#ffffff"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="98" cy="98" r="13" fill="#ffffff" />
      <path
        d="M98 104 C94.5 100.5 93 98.6 93 96.6 C93 94.6 94.5 93.2 96.4 93.2 C97.3 93.2 97.9 93.6 98 94.1 C98.1 93.6 98.7 93.2 99.6 93.2 C101.5 93.2 103 94.6 103 96.6 C103 98.6 101.5 100.5 98 104 Z"
        fill="#174a7c"
      />
    </svg>
  );
}
