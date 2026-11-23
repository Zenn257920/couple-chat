// Regression checks for the separate nav pages (2026-11-23):
// bottom nav on EVERY nav page with a visible active state, the +
// FAB floating clear of the nav, Settings / Profile / Add Friend as
// their own pages (no shared settings sheet).
// Run: node scripts/check-pages-nav.mjs (exit 0 = all pass)
import { readFileSync } from "node:fs";
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

console.log("shared bottom nav:");
check("one bottomNav helper, used by every page", page.includes("function bottomNav(") && (page.match(/bottomNav\("/g) || []).length >= 5);
check("active tab gets an ocean pill", page.includes('active === tab ? "bg-ice-deep text-ocean" : "text-ink-soft"'));
check("Chats tab in nav (with unread badge)", page.includes('"chats"') && page.includes("totalUnread"));
check("nav on Chats / Friends / Settings / Profile", page.includes('bottomNav("chats"') && page.includes('bottomNav("friends")') && page.includes('bottomNav("settings")') && page.includes('bottomNav("profile")'));
check("Add Friend page also keeps the nav (Friends active)", /addFriendScreen[\s\S]*?bottomNav\("friends"\)/.test(page));

console.log("FAB clear of the nav:");
check("FAB floats above the nav, not overlapping it", page.includes('absolute -top-[4.75rem] right-4') && !page.includes("absolute -top-6 right-3"));
check("chat list has clearance under the FAB", page.includes("px-4 pt-4 pb-20"));
check("FAB only on the Chats list", (page.match(/bottomNav\("chats", true\)/g) || []).length === 1);

console.log("separate pages:");
check("no shared settings sheet overlay left", !page.includes("Settings sheet") && !page.includes("Signed in as"));
check("Settings page: wallpaper + Together + Log out, no photo", /settingsScreen[\s\S]*?Chat wallpaper[\s\S]*?Together since[\s\S]*?Log out/.test(page));
check("Profile page: photo + name + email", /profileScreen[\s\S]*?My profile photo[\s\S]*?session\.user\.name[\s\S]*?session\.user\.email/.test(page));
check("Add Friend page: back to Friends + search moved there", /addFriendScreen[\s\S]*?Back to friends[\s\S]*?Search people/.test(page));
check("Friends page: + button opens Add Friend", page.includes('aria-label="Add friend"') && page.includes("setShowAddFriend(true)"));
check("return switches between all five pages", page.includes("showAddFriend") && page.includes("showSettings") && page.includes("showProfile"));

console.log("back button:");
check("back: Add Friend -> Friends, pages -> Chats, list -> exit", page.includes("showAddFriendRef.current") && page.includes("showProfileRef.current") && page.includes("App.exitApp()"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
