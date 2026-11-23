// Regression checks for the Telegram-style room list (2026-11-23):
// light colours kept, title row (no header card), friends strip with
// online rings, search, All Chats / Groups tabs (NO Unread tab),
// bottom nav + new-group FAB, presence from /api/rooms.
// Run: node scripts/check-telegram-list.mjs (exit 0 = all pass)
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

const page = read("src/app/page.tsx");
const roomsRoute = read("src/app/api/rooms/route.ts");

console.log("title row (header card gone):");
check("We Talk title row, no header card", page.includes('<h1 className="text-2xl font-bold text-ink">We Talk</h1>') && !page.includes("• {rooms.length} chat"));

console.log("friends strip:");
check("strip renders friends with online gradient ring", page.includes("bg-gradient-to-br from-ocean-light via-ocean to-green-500") && page.includes("openDM(u.id)"));
check("strip hidden while searching", page.includes('roomQuery === "" && friends.length > 0'));
check("friends loaded when the list shows", page.includes("void fetchFriends();") && /if \(!session \|\| activeRoom\) return;\s*void fetchRooms\(\);\s*\/\/ The friends strip[\s\S]*?void fetchFriends\(\);/.test(page));

console.log("search + tabs:");
check("search input filters rooms", page.includes('placeholder="Search chats"') && page.includes("visibleRooms"));
check("All Chats / Groups tabs present", page.includes("All Chats") && page.includes("Groups"));
check("NO Unread tab", !page.includes("Unread") || !/>\s*Unread\s*</.test(page));
check("no-match empty state", page.includes("No chats found"));

console.log("bottom nav + FAB:");
check("bottom nav: Chats / Friends / Settings / Profile", page.includes('aria-label="Chats"') && page.includes('aria-label="Friends"') && page.includes('aria-label="Settings"') && page.includes('aria-label="Profile"'));
check("Chats tab shows total unread badge", page.includes("totalUnread"));
check("FAB opens group creation", page.includes('aria-label="New group"') && page.includes("setShowGroupCreate(true)"));
check("old full-width New group button gone", !page.includes("New group\n"));

console.log("presence on the list:");
check("/api/rooms returns presence", roomsRoute.includes("getPresence") && roomsRoute.includes("presence"));
check("fetchRooms stores presence", page.includes("if (data.presence) setPresence(data.presence)"));

console.log("colours kept light:");
check("no dark Telegram background", !page.includes("#0e1621") && !page.includes("#17212b"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
