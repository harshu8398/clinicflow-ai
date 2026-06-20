import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { sendOtpEmail } from "../lib/email";
import crypto from "crypto";
import { validateActiveClinicSubscription } from "./subscriptions";
const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || !email.includes("@") || typeof password !== "string" || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()));

  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  req.session.authenticated = true;
  req.session.userId = user.id;
  req.session.clinicId = user.clinicId;
  req.session.role = user.role;

  // Validate/update subscription on login
  if (user.clinicId && user.role !== "system_owner") {
    try {
      await validateActiveClinicSubscription(user.clinicId);
    } catch (err) {
      console.error("Subscription validation failed on login:", err);
    }
  }

  res.json({
    userId: user.id,
    clinicId: user.clinicId,
    role: user.role,
    email: user.email,
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Logout failed" });
      return;
    }
    res.clearCookie("clinicflow.sid");
    res.json({ ok: true });
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.authenticated) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  
  const isSystemOwner = req.session.role === "system_owner" && !req.session.originalSystemOwnerUserId;
  if (req.session.clinicId && !isSystemOwner) {
    try {
      await validateActiveClinicSubscription(req.session.clinicId);
    } catch (err) {
      console.error("Subscription validation failed on /auth/me:", err);
    }
  }

  res.json({
    userId: req.session.userId,
    clinicId: req.session.clinicId,
    role: req.session.role,
    originalSystemOwnerUserId: req.session.originalSystemOwnerUserId || null,
  });
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body ?? {};

  if (typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "A valid email address is required" });
    return;
  }

  // Rate Limiting: 60 seconds cooldown check
  const lastSent = req.session.resetOtpLastSentAt;
  if (lastSent && Date.now() - lastSent < 60 * 1000) {
    const waitTime = Math.ceil((60 * 1000 - (Date.now() - lastSent)) / 1000);
    res.status(429).json({ error: `Please wait ${waitTime} seconds before requesting a new OTP.` });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()));

    if (!user) {
      res.status(404).json({ error: "No administrator found with this email address" });
      return;
    }

    // Generate secure 6-digit OTP
    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

    req.session.resetOtp = code;
    req.session.resetOtpEmail = user.email;
    req.session.resetOtpExpiresAt = expiresAt;
    req.session.resetOtpLastSentAt = Date.now();

    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log(`\n========================================\n[PASSWORD RESET OTP] for ${user.email}:\nOTP: ${code}\n========================================\n`);

    // Send the email using Gmail SMTP
    try {
      await sendOtpEmail(user.email, code);
    } catch (emailErr) {
      console.error("Failed to send OTP email via SMTP:", emailErr);
      res.status(500).json({ error: "Failed to send verification email. Please check SMTP configuration." });
      return;
    }

    res.json({ success: true, message: "Verification code sent to your email address" });
  } catch (err: any) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Failed to process forgot password request" });
  }
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { email, code, newPassword, confirmPassword } = req.body ?? {};

  if (typeof email !== "string" || typeof code !== "string" || typeof newPassword !== "string" || typeof confirmPassword !== "string" || !newPassword) {
    res.status(400).json({ error: "Email, code, new password, and confirm password are required" });
    return;
  }

  if (newPassword !== confirmPassword) {
    res.status(400).json({ error: "New password and confirmation password do not match" });
    return;
  }

  try {
    const sessionEmail = req.session.resetOtpEmail;
    const sessionOtp = req.session.resetOtp;
    const sessionExpiresAt = req.session.resetOtpExpiresAt;

    if (!sessionEmail || !sessionOtp || !sessionExpiresAt) {
      res.status(400).json({ error: "Session expired or reset not initiated" });
      return;
    }

    if (sessionEmail.toLowerCase().trim() !== email.toLowerCase().trim()) {
      res.status(400).json({ error: "Email does not match reset session" });
      return;
    }

    if (sessionOtp !== code.trim()) {
      res.status(400).json({ error: "Invalid verification code" });
      return;
    }

    if (Date.now() > sessionExpiresAt) {
      res.status(400).json({ error: "Verification code has expired" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()));

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db
      .update(usersTable)
      .set({ passwordHash })
      .where(eq(usersTable.id, user.id));

    // Clear reset OTP fields from session
    req.session.resetOtp = undefined;
    req.session.resetOtpEmail = undefined;
    req.session.resetOtpExpiresAt = undefined;
    req.session.resetOtpLastSentAt = undefined;

    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err: any) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

export default router;
