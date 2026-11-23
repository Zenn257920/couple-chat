import { NextResponse } from "next/server";

// Tells the client which sign-in methods are available. Google only
// appears once the OAuth client exists (GOOGLE_CLIENT_ID/SECRET);
// email+password is always on.
export async function GET() {
  return NextResponse.json({
    google: !!(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ),
  });
}
