import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, faqsTable } from "@workspace/db";
import {
  ListFaqsParams,
  ListFaqsResponse,
  CreateFaqParams,
  CreateFaqBody,
  DeleteFaqParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeFaq(f: Record<string, unknown>) {
  return { ...f, createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : f.createdAt };
}

router.get("/clinics/:clinicId/faqs", async (req, res): Promise<void> => {
  const params = ListFaqsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const faqs = await db
    .select()
    .from(faqsTable)
    .where(eq(faqsTable.clinicId, params.data.clinicId))
    .orderBy(faqsTable.createdAt);

  res.json(ListFaqsResponse.parse(faqs.map(serializeFaq)));
});

router.post("/clinics/:clinicId/faqs", async (req, res): Promise<void> => {
  const params = CreateFaqParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateFaqBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [faq] = await db
    .insert(faqsTable)
    .values({ ...parsed.data, clinicId: params.data.clinicId })
    .returning();

  res.status(201).json(serializeFaq(faq));
});

router.delete("/clinics/:clinicId/faqs/:faqId", async (req, res): Promise<void> => {
  const params = DeleteFaqParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [faq] = await db
    .delete(faqsTable)
    .where(
      and(
        eq(faqsTable.id, params.data.faqId),
        eq(faqsTable.clinicId, params.data.clinicId)
      )
    )
    .returning();

  if (!faq) {
    res.status(404).json({ error: "FAQ not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
