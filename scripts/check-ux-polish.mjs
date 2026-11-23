// Regression checks for the UX polish batch (2026-11-23):
// 1. Sign-up does NOT drop the user into the app — it signs the new
//    account back out and shows the login form with a success notice.
// 2. Every button shows a press (global button:active rule).
// 3. Skeleton loaders for rooms / messages / friends.
// 4. Branded splash (W logo) on app entry, min ~0.9s.
// Run: node scripts/check-ux-polish.mjs (exit 0 = all pass)
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

let pass = 0;
let fail = 0;
function check(name, ok) {
  if (ok) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
}

const auth = read("src/components/AuthScreen.tsx");
const logo = existsSync(join(root, "src/components/Logo.tsx"))
  ? read("src/components/Logo.tsx")
  : "";
const css = read("src/app/globals.css");
const page = read("src/app/page.tsx");

console.log("signup -> login:");
check("autoSignIn is off in auth.ts (no session after signup)", /autoSignIn:\s*false/.test(read("src/lib/auth.ts")));
check("success notice shown", auth.includes("Account created — please sign in."));
check("switches to signin mode after signup", /setMode\("signin"\)/.test(auth));
check("password cleared after signup", auth.includes('setPassword("")'));
check("email kept for login (not cleared)", !/setEmail\(""\)/.test(auth));

console.log("W logo:");
check("Logo.tsx exists with inline SVG", logo.includes("<svg") && logo.includes("viewBox=\"0 0 120 120\""));
check("logo has the W stroke", logo.includes("M30 40 L42 80 L60 52 L78 80 L90 40"));
check("AuthScreen uses the Logo", auth.includes("Logo") && auth.includes("<Logo"));
check("splash uses the Logo", page.includes("<Logo"));

console.log("button press feedback:");
check("global button:active scale rule", /button:active\s*\{[^}]*scale:\s*0\.96/.test(css));
check("buttons transition scale/filter", css.includes("transition-property") && css.includes("scale, filter"));

console.log("skeletons:");
check("skeleton shimmer CSS", css.includes(".skeleton") && css.includes("skeleton-shimmer"));
check("roomsLoading state + skeleton rows", page.includes("roomsLoading") && page.includes("roomsLoading && rooms.length === 0"));
check("msgsLoading state + skeleton bubbles", page.includes("msgsLoading") && page.includes("msgsLoading && messages.length === 0"));
check("friendsLoading state + skeleton rows", page.includes("friendsLoading") && page.includes("friendsLoading && friends.length === 0"));

console.log("splash:");
check("splash minimum-display timer", page.includes("splashMinDone") && page.includes("900"));
check("splash shows logo + dots, not plain Loading text", page.includes("Chat with your friends") && !page.includes("Loading… <Heart"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
