import {
  OtpError,
  isValidEmail,
  normalizeEmail,
  verifySignupOtp,
} from "@/lib/signup-otp";

/**
 * POST /api/auth/verify-signup-otp { email, otp }
 * Public endpoint used by the sign-up form. On success the email is
 * marked verified for 15 minutes, during which sign-up is allowed.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: unknown;
      otp?: unknown;
    };
    const email =
      typeof body.email === "string" ? normalizeEmail(body.email) : "";
    const otp = typeof body.otp === "string" ? body.otp.trim() : "";
    if (!isValidEmail(email)) {
      throw new OtpError("Enter a valid email address.", 400);
    }
    if (!/^\d{6}$/.test(otp)) {
      throw new OtpError("Enter the 6-digit code.", 400);
    }

    await verifySignupOtp(email, otp);
    return Response.json({ success: true, message: "Email verified." });
  } catch (error) {
    const status = error instanceof OtpError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : "Could not verify the code.";
    return Response.json({ success: false, message }, { status });
  }
}
