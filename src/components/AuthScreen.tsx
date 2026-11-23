"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import Logo from "@/components/Logo";

// Sign in / sign up screen — shown when there is no session. The
// chat itself is friends-only, so every user needs an account.
// Google sign-in appears only once the Google OAuth client is
// configured on the server (see /api/auth/config); email+password
// always works, including inside the Android app's WebView, where
// Google's web button is often blocked.
export default function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { google?: boolean }) => setGoogleEnabled(!!d.google))
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await authClient.signUp.email({
          name: name.trim() || email.trim(),
          email: email.trim(),
          password,
        });
        if (error) throw new Error(error.message || "Sign up failed");
        // Better Auth signs the new account straight in — sign back
        // out so creating an account does NOT drop the user into the
        // app. They sign in explicitly, with their email prefilled.
        await authClient.signOut();
        setNotice("Account created — please sign in.");
        setMode("signin");
        setPassword("");
        return;
      }
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

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ice px-6">
      <div className="fade-up flex w-full max-w-sm flex-col items-center">
        <Logo className="h-20 w-20 drop-shadow-lg" />
        <h1 className="mt-6 text-2xl font-bold text-ink">We Talk</h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-ink-soft">
          Chat with your friends, one-to-one or in groups.
          <br />
          {mode === "signup"
            ? "Create your account to get started."
            : "Sign in to continue."}
        </p>

        {googleEnabled && (
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
            {mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setError("");
            setNotice("");
          }}
          className="mt-4 text-sm font-semibold text-ocean"
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}
