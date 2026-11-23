// Regression checks for the two UI fixes from 2026-11-23 (run: node scripts/check-ui-fixes.mjs):
//  1. Presence dot half-clipped: the green/grey dot was a CHILD of the
//     avatar div with overflow-hidden, so the half sticking out past the
//     circle edge got cut off. The dot must now be a SIBLING of the
//     clipped avatar (outer relative wrapper + inner overflow-hidden
//     circle), in the header, the room list and the friends list.
//  2. Android back button exits the app from a chat room: the app had
//     no back-button handling at all. It must now register Capacitor
//     App's backButton listener and walk home one layer at a time
//     (emoji/settings/group/room/friends), exiting only on the list.
import { readFileSync } from "node:fs";

const src = readFileSync(
  new URL("../src/app/page.tsx", import.meta.url),
  "utf8",
);
const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const failures = [];
function check(name, ok) {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
  if (!ok) failures.push(name);
}

// --- 1. Presence dot lives outside the overflow-hidden avatar ---
const dotRe = /absolute -right-0\.5 -bottom-0\.5 h-3(?:\.5)? w-3(?:\.5)?/g;
const dots = [...src.matchAll(dotRe)];
check("three presence dots use the overlapping position", dots.length === 3);
for (const [i, m] of dots.entries()) {
  const before = src.slice(0, m.index);
  const avatarOpen = before.lastIndexOf("overflow-hidden rounded-full");
  const between = src.slice(avatarOpen, m.index);
  check(
    `dot ${i + 1} sits after its avatar div closes (not inside overflow-hidden)`,
    between.includes("</div>"),
  );
}

// --- 2. Android back button ---
check("@capacitor/app is a dependency", Boolean(pkg.dependencies["@capacitor/app"]));
check(
  "backButton listener is registered",
  src.includes('App.addListener("backButton"'),
);
check(
  "back handler closes the room before exiting",
  src.includes("if (activeRoomRef.current) {") &&
    src.includes("void App.exitApp()"),
);
check(
  "back handler is native-only (no-op on the web)",
  src.includes("Capacitor.isNativePlatform()"),
);

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nAll UI-fix checks passed.");
