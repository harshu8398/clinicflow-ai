import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
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

router.get("/auth/me", (req, res): void => {
  if (!req.session.authenticated) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({
    userId: req.session.userId,
    clinicId: req.session.clinicId,
    role: req.session.role,
  });
});

export default router;
