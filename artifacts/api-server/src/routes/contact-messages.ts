import { Router, type IRouter } from "express";
import { db, contactMessagesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { sendContactMessageEmail } from "../lib/email";

const router: IRouter = Router();

function requireSystemOwner(req: any, res: any, next: any) {
  const isSystemOwner = req.session.role === "system_owner" || req.session.originalRole === "system_owner";
  if (!isSystemOwner) {
    res.status(403).json({ error: "Access denied: System Owner only" });
    return;
  }
  next();
}

// POST /api/contact-messages (Public)
router.post("/contact-messages", async (req, res): Promise<void> => {
  const { name, email, message } = req.body ?? {};

  if (!name || !email || !message) {
    res.status(400).json({ error: "Name, Email, and Message are required." });
    return;
  }

  try {
    const [inserted] = await db
      .insert(contactMessagesTable)
      .values({
        name,
        email,
        message,
        isRead: false,
      })
      .returning();

    // Send email notification to System Owner
    await sendContactMessageEmail({
      name,
      email,
      message,
      createdAt: inserted.createdAt,
    });

    res.status(201).json({
      success: true,
      message: "Your message has been sent successfully.",
      contactMessage: inserted,
    });
  } catch (err: any) {
    console.error("Contact message submission failed:", err);
    res.status(500).json({ error: "Failed to send message." });
  }
});

// GET /api/contact-messages (Protected - System Owner only)
router.get("/contact-messages", requireAuth, requireSystemOwner, async (req, res): Promise<void> => {
  try {
    const messages = await db
      .select()
      .from(contactMessagesTable)
      .orderBy(desc(contactMessagesTable.createdAt));

    res.json({
      success: true,
      messages: messages.map(m => ({
        ...m,
        createdAt: m.createdAt.toISOString()
      }))
    });
  } catch (err: any) {
    console.error("Failed to load contact messages:", err);
    res.status(500).json({ error: "Failed to load contact messages" });
  }
});

// PATCH /api/contact-messages/:id/read (Protected - System Owner only)
router.patch("/contact-messages/:id/read", requireAuth, requireSystemOwner, async (req, res): Promise<void> => {
  const messageId = Number(req.params.id);

  if (isNaN(messageId)) {
    res.status(400).json({ error: "Invalid message ID." });
    return;
  }

  try {
    const [updated] = await db
      .update(contactMessagesTable)
      .set({ isRead: true })
      .where(eq(contactMessagesTable.id, messageId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Contact message not found." });
      return;
    }

    res.json({ success: true, message: updated });
  } catch (err: any) {
    console.error("Failed to mark message as read:", err);
    res.status(500).json({ error: "Failed to update contact message status." });
  }
});

// DELETE /api/contact-messages/:id (Protected - System Owner only)
router.delete("/api-or-route-placeholder-match-bypass/:id", () => {}); // placeholder if needed

router.delete("/contact-messages/:id", requireAuth, requireSystemOwner, async (req, res): Promise<void> => {
  const messageId = Number(req.params.id);

  if (isNaN(messageId)) {
    res.status(400).json({ error: "Invalid message ID." });
    return;
  }

  try {
    const [deleted] = await db
      .delete(contactMessagesTable)
      .where(eq(contactMessagesTable.id, messageId))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Contact message not found." });
      return;
    }

    res.json({ success: true, message: deleted });
  } catch (err: any) {
    console.error("Failed to delete message:", err);
    res.status(500).json({ error: "Failed to delete contact message." });
  }
});

export default router;
