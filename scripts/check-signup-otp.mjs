// Regression checks for Gmail sign-up OTP confirmation (2026-11-23):
// sign-up is two steps (details -> 6-digit OTP emailed -> verify ->
// account created), the server refuses sign-up for an unverified
// email, and the code is sent via Gmail SMTP.
// Run: node scripts/check-signup-otp.mjs (exit 0 = all pass)
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

const auth = read("src/lib/auth.ts");
const otp = existsSync(join(root, "src/lib/signup-otp.ts"))
  ? read("src/lib/signup-otp.ts")
  : "";
const email = existsSync(join(root, "src/lib/email.ts"))
  ? read("src/lib/email.ts")
  : "";
const screen = read("src/components/AuthScreen.tsx");
const sendRoute = existsSync(join(root, "src/app/api/auth/send-signup-otp/route.ts"))
  ? read("src/app/api/auth/send-signup-otp/route.ts")
  : "";
const verifyRoute = existsSync(join(root, "src/app/api/auth/verify-signup-otp/route.ts"))
  ? read("src/app/api/auth/verify-signup-otp/route.ts")
  : "";
const pkg = read("package.json");

console.log("server OTP module:");
check("signup-otp.ts exists", otp.length > 0);
check("codes stored hashed (SHA-256), never plain", otp.includes("createHash(\"sha256\")") && !/value: `?\$\{otp\}`/.test(otp));
check("6-digit code, 10-min TTL, 5 attempts, 60s resend cooldown", otp.includes("OTP_LENGTH = 6") && otp.includes("10 * 60 * 1000") && otp.includes("MAX_ATTEMPTS = 5") && otp.includes("60 * 1000"));
check("verified marker (15 min) + consume + isSignupVerified", otp.includes("signup-verified") && otp.includes("consumeSignupVerification") && otp.includes("isSignupVerified"));

console.log("email sender:");
check("Gmail SMTP via GMAIL_USER + GMAIL_APP_PASSWORD", email.includes("GMAIL_USER") && email.includes("GMAIL_APP_PASSWORD") && email.includes("smtp.gmail.com"));
check("We Talk branded OTP email", email.includes("sendSignupOtpEmail") && email.includes("We Talk"));

console.log("API routes:");
check("send route checks the email is not already registered", sendRoute.includes("already exists"));
check("send route emails the code", sendRoute.includes("sendSignupOtpEmail"));
check("verify route checks a 6-digit code", verifyRoute.includes("\\d{6}"));

console.log("auth gate:");
check("user.create.before refuses unverified sign-up", auth.includes("isSignupVerified") && auth.includes("Please verify your email with the OTP code first"));
check("user.create.after marks emailVerified + consumes marker", auth.includes("emailVerified: true") && auth.includes("consumeSignupVerification"));
check("autoSignIn is off", /autoSignIn:\s*false/.test(auth));

console.log("sign-up screen:");
check("two steps: details -> otp", screen.includes('"details" | "otp"') && screen.includes('setStep("otp")'));
check("auto-submit at 6 digits", screen.includes("next.length === 6"));
check("resend with 60s cooldown + expiry countdown", screen.includes("Resend in") && screen.includes("Code expires in"));
check("account created only after verify, then login screen", screen.includes("verify-signup-otp") && screen.includes("Account created — please sign in."));

console.log("deps:");
check("nodemailer installed", pkg.includes('"nodemailer"'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
