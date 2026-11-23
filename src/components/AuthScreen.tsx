"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import Logo from "@/components/Logo";

// Sign in / sign up screen — shown when there is no session. The
// chat itself is friends-only, so every user needs an account.
// Google sign-in appears only once the Google OAuth client is
// configured on the server (see /api/auth/config); email+password
// always works, including inside the Android app's WebView, where
// Google's web button is often blocked.
//
// Sign-up is two steps: details -> a 6-digit OTP is emailed to the
// address -> the code is verified and only then is the account
// created (the server refuses sign-up for an unverified email — see
// src/lib/signup-otp.ts). After creation the user signs in explicitly.
function formatCountdown(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [step, setStep] = useState<"details" | "otp">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [resendIn, setResendIn] = useState(0);
  // The OTP code expires 10 minutes after it is sent.
  const [otpExpiresIn, setOtpExpiresIn] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const otpSubmittingRef = useRef(false);

  useEffect(() => {
    void fetch("/api/auth/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { google?: boolean }) => setGoogleEnabled(!!d.google))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(
      () => setResendIn((value) => value - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (otpExpiresIn <= 0) return;
    const timer = window.setTimeout(
      () => setOtpExpiresIn((value) => value - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [otpExpiresIn]);

  async function postOtp(path: string, body: Record<string, string>) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: { message?: string } = await response
      .json()
      .catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message ?? "Something went wrong. Please try again.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (mode === "signin") {
      setBusy(true);
      try {
        const { error } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (error) throw new Error(error.message || "Sign in failed");
        // Success: useSession in the page picks up the new session and
        // the chat appears — no navigation needed.
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setBusy(false);
      }
      return;
    }
    // Sign-up step 1: send the OTP. The account is created only after
    // the code is verified (see submitOtp below).
    setBusy(true);
    try {
      await postOtp("/api/auth/send-signup-otp", { email: email.trim() });
      setResendIn(60);
      setOtpExpiresIn(600);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp(code: string) {
    if (!/^\d{6}$/.test(code) || otpSubmittingRef.current) return;
    otpSubmittingRef.current = true;
    setError("");
    setBusy(true);
    try {
      // Verify the code, then create the account. The server refuses
      // sign-up while the email is not verified.
      await postOtp("/api/auth/verify-signup-otp", {
        email: email.trim(),
        otp: code,
      });
      const { error } = await authClient.signUp.email({
        name: name.trim() || email.trim(),
        email: email.trim(),
        password,
      });
      if (error) throw new Error(error.message || "Sign up failed");
      // autoSignIn is off, so sign-up returns no session — sign in
      // explicitly, with the email prefilled.
      setNotice("Account created — please sign in.");
      setMode("signin");
      setStep("details");
      setPassword("");
      setOtp("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify the code.");
    } finally {
      otpSubmittingRef.current = false;
      setBusy(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Enter the 6-digit code.");
      return;
    }
    await submitOtp(otp.trim());
  }

  async function handleResend() {
    if (resendIn > 0 || isResending) return;
    setError("");
    setIsResending(true);
    try {
      await postOtp("/api/auth/send-signup-otp", { email: email.trim() });
      setResendIn(60);
      setOtpExpiresIn(600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the code.");
    } finally {
      setIsResending(false);
    }
  }

  async function signInWithGoogle() {
    setError("");
    setBusy(true);
    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
      if (error) throw new Error(error.message || "Google sign-in failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  const isOtpStep = mode === "signup" && step === "otp";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ice px-6">
      <div className="fade-up flex w-full max-w-sm flex-col items-center">
        <Logo className="h-20 w-20 drop-shadow-lg" />
        <h1 className="mt-6 text-2xl font-bold text-ink">We Talk</h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-ink-soft">
          {isOtpStep ? (
            <>
              We sent a 6-digit code to {email.trim()}. Enter it below to
              verify your email.
            </>
          ) : (
            <>
              Chat with your friends, one-to-one or in groups.
              <br />
              {mode === "signup"
                ? "Create your account to get started."
                : "Sign in to continue."}
            </>
          )}
        </p>

        {googleEnabled && !isOtpStep && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void signInWithGoogle()}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-card px-6 py-3.5 text-base font-bold text-ink shadow-md transition active:scale-[0.98] disabled:opacity-50"
          >
            <span className="text-lg">G</span>
            Continue with Google
          </button>
        )}

        {isOtpStep ? (
          <form onSubmit={(e) => void handleOtpSubmit(e)} className="mt-4 w-full">
            <label className="block text-sm font-semibold text-ink-soft">
              Verification code
              <input
                value={otp}
                onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setOtp(next);
                  // Auto-submit once the 6th digit is entered.
                  if (next.length === 6) void submitOtp(next);
                }}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-center text-xl font-bold tracking-[0.4em] text-ink outline-none focus:border-ocean"
              />
            </label>
            <p className="mt-2 text-center text-xs text-ink-soft">
              {otpExpiresIn > 0
                ? `Code expires in ${formatCountdown(otpExpiresIn)}`
                : "This code has expired. Request a new one below."}
            </p>
            {error && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-ocean px-6 py-3.5 text-base font-bold text-white shadow-md transition active:scale-[0.98] disabled:opacity-50"
            >
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {busy ? "Please wait..." : "Verify & create account"}
            </button>
            <div className="mt-4 flex items-center justify-between text-sm">
              <button
                type="button"
                disabled={busy || isResending}
                onClick={() => {
                  setStep("details");
                  setOtp("");
                  setError("");
                }}
                className="font-semibold text-ocean disabled:opacity-50"
              >
                Change email
              </button>
              <button
                type="button"
                disabled={busy || isResending || resendIn > 0}
                onClick={() => void handleResend()}
                className="font-semibold text-ocean disabled:opacity-50"
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="mt-4 w-full">
            {mode === "signup" && (
              <label className="block text-sm font-semibold text-ink-soft">
                Your name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What should friends call you?"
                  autoComplete="name"
                  className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-ink outline-none focus:border-ocean"
                />
              </label>
            )}
            <label className="mt-3 block text-sm font-semibold text-ink-soft">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-ink outline-none focus:border-ocean"
              />
            </label>
            <label className="mt-3 block text-sm font-semibold text-ink-soft">
              Password
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-ink outline-none focus:border-ocean"
              />
            </label>
            {notice && (
              <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
                {notice}
              </p>
            )}
            {error && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-ocean px-6 py-3.5 text-base font-bold text-white shadow-md transition active:scale-[0.98] disabled:opacity-50"
            >
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {mode === "signup" ? "Send verification code" : "Sign in"}
            </button>
          </form>
        )}

        {!isOtpStep && (
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signup" ? "signin" : "signup");
              setStep("details");
              setError("");
              setNotice("");
            }}
            className="mt-4 text-sm font-semibold text-ocean"
          >
            {mode === "signup"
              ? "Already have an account? Sign in"
              : "New here? Create an account"}
          </button>
        )}
      </div>
    </div>
  );
}
