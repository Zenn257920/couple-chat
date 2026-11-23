// Server-side session helper: every chat API requires a logged-in
// user. Returns the Better Auth session (with user) or null.
import { headers } from "next/headers";

import { auth } from "@/lib/auth";

export async function requireSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export type SessionUser = NonNullable<
  Awaited<ReturnType<typeof requireSession>>
>["user"];
