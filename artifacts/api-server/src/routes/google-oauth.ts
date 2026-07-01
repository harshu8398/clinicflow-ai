import { Router } from "express";
import { getAuthUrl, getTokensFromCode, getUserEmail } from "../lib/google-calendar";
import { db, clinicsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/clinics/:clinicId/auth/google", async (req, res) => {
  const clinicId = Number(req.params.clinicId);
  if (isNaN(clinicId)) {
    res.status(400).json({ error: "Invalid clinic ID" });
    return;
  }
  const url = getAuthUrl(clinicId);
  res.redirect(url);
});

router.get("/clinics/:clinicId/auth/google/callback", async (req, res) => {
  const clinicId = Number(req.params.clinicId);
  const code = req.query.code as string;
  const error = req.query.error as string;
  const state = req.query.state as string;

  const stateClinicId = state ? Number(state) : NaN;
  const targetClinicId = !isNaN(stateClinicId) ? stateClinicId : clinicId;

  const host = req.headers.host || "localhost:3000";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  const baseRedirect = isLocalhost
    ? `http://localhost:3000/admin/${targetClinicId}/settings`
    : `${process.env.CLIENT_URL || "https://clinicflow-wine.vercel.app"}/admin/${targetClinicId}/settings`;

  if (error || !code) {
    console.error("Google OAuth error or code missing:", error);
    res.redirect(`${baseRedirect}?error=${encodeURIComponent(error || "Authorization denied")}`);
    return;
  }

  try {
    const tokens = await getTokensFromCode(code, clinicId);
    const email = await getUserEmail(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await db
      .update(clinicsTable)
      .set({
        googleConnected: true,
        googleConnectedEmail: email,
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleTokenExpiresAt: expiresAt,
        googleCalendarId: "primary"
      })
      .where(eq(clinicsTable.id, targetClinicId));

    res.redirect(`${baseRedirect}?connected=true`);
  } catch (err: any) {
    console.error("Failed Google OAuth Callback:", err);
    res.redirect(`${baseRedirect}?error=${encodeURIComponent(err.message || "Failed to connect Google Calendar")}`);
  }
});

router.post("/clinics/:clinicId/auth/google/disconnect", async (req, res) => {
  const clinicId = Number(req.params.clinicId);
  if (isNaN(clinicId)) {
    res.status(400).json({ error: "Invalid clinic ID" });
    return;
  }

  try {
    await db
      .update(clinicsTable)
      .set({
        googleConnected: false,
        googleConnectedEmail: null,
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiresAt: null,
        googleCalendarId: null
      })
      .where(eq(clinicsTable.id, clinicId));

    res.json({ success: true });
  } catch (err: any) {
    console.error("Failed to disconnect Google Calendar:", err);
    res.status(500).json({ error: "Failed to disconnect Google Calendar" });
  }
});

export default router;
