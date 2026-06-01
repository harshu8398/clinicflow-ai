import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, appointmentsTable } from "@workspace/db";
import { GetDashboardParams, GetDashboardResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function serializeAppt(a: Record<string, unknown>) {
  return { ...a, createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt };
}

router.get("/clinics/:clinicId/dashboard", async (req, res): Promise<void> => {
  const params = GetDashboardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { clinicId } = params.data;
  const todayStr = new Date().toISOString().split("T")[0];

  const allAppointments = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.clinicId, clinicId))
    .orderBy(appointmentsTable.createdAt);

  const serialized = allAppointments.map(serializeAppt);
  const totalAppointments = serialized.length;
  const todayAppointments = serialized.filter((a) =>
    String(a.appointmentDate).startsWith(todayStr)
  ).length;
  const pendingCount = serialized.filter((a) => a.status === "pending").length;
  const confirmedCount = serialized.filter((a) => a.status === "confirmed").length;
  const completedCount = serialized.filter((a) => a.status === "completed").length;
  const recentAppointments = [...serialized]
    .sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime())
    .slice(0, 5);

  res.json(
    GetDashboardResponse.parse({
      totalAppointments,
      todayAppointments,
      pendingCount,
      confirmedCount,
      completedCount,
      recentAppointments,
    })
  );
});

export default router;
