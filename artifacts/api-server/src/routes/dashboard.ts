import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, appointmentsTable, blockedSlotsTable, blockedDaysTable, clinicsTable, subscriptionSettingsTable } from "@workspace/db";
import { GetDashboardParams, GetDashboardResponse } from "@workspace/api-zod";
import { requireAuth, requireClinicOwnership } from "../middleware/auth";
import { validateActiveClinicSubscription } from "./subscriptions";

const router: IRouter = Router();

function serializeAppt(a: any) {
  return { ...a, createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt };
}

router.get("/clinics/:clinicId/dashboard", requireAuth, requireClinicOwnership, async (req, res): Promise<void> => {
  const params = GetDashboardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { clinicId } = params.data;
  const todayStr = new Date().toISOString().split("T")[0];

  try {
    const getCount = async (whereClause: any, table: any = appointmentsTable) => {
      const [resCount] = await db
        .select({ value: sql<number>`count(*)` })
        .from(table)
        .where(whereClause);
      return Number(resCount?.value ?? 0);
    };

    const totalAppointments = await getCount(eq(appointmentsTable.clinicId, clinicId));
    const todayAppointments = await getCount(
      and(
        eq(appointmentsTable.clinicId, clinicId),
        eq(appointmentsTable.appointmentDate, todayStr)
      )
    );
    const pendingCount = await getCount(
      and(
        eq(appointmentsTable.clinicId, clinicId),
        eq(appointmentsTable.status, "pending")
      )
    );
    const confirmedCount = await getCount(
      and(
        eq(appointmentsTable.clinicId, clinicId),
        eq(appointmentsTable.status, "confirmed")
      )
    );
    const completedCount = await getCount(
      and(
        eq(appointmentsTable.clinicId, clinicId),
        eq(appointmentsTable.status, "completed")
      )
    );
    const todayOnlineAppointments = await getCount(
      and(
        eq(appointmentsTable.clinicId, clinicId),
        eq(appointmentsTable.appointmentDate, todayStr),
        eq(appointmentsTable.appointmentSource, "Online")
      )
    );
    const todayManualAppointments = await getCount(
      and(
        eq(appointmentsTable.clinicId, clinicId),
        eq(appointmentsTable.appointmentDate, todayStr),
        sql`appointment_source != 'Online'`
      )
    );
    const todayCompletedAppointments = await getCount(
      and(
        eq(appointmentsTable.clinicId, clinicId),
        eq(appointmentsTable.appointmentDate, todayStr),
        eq(appointmentsTable.status, "completed")
      )
    );
    const todayCancelledAppointments = await getCount(
      and(
        eq(appointmentsTable.clinicId, clinicId),
        eq(appointmentsTable.appointmentDate, todayStr),
        eq(appointmentsTable.status, "cancelled")
      )
    );

    const blockedSlotsCount = await getCount(
      and(
        eq(blockedSlotsTable.clinicId, clinicId),
        eq(blockedSlotsTable.date, todayStr)
      ),
      blockedSlotsTable
    );

    const blockedDaysCount = await getCount(
      and(
        eq(blockedDaysTable.clinicId, clinicId),
        eq(blockedDaysTable.date, todayStr)
      ),
      blockedDaysTable
    );

    const todayBlockedSlots = blockedSlotsCount + (blockedDaysCount > 0 ? 1 : 0);

    const recentAppointmentsRaw = await db
      .select({
        id: appointmentsTable.id,
        clinicId: appointmentsTable.clinicId,
        sessionId: appointmentsTable.sessionId,
        patientName: appointmentsTable.patientName,
        patientPhone: appointmentsTable.patientPhone,
        patientProblem: appointmentsTable.patientProblem,
        appointmentDate: appointmentsTable.appointmentDate,
        selectedTimeSlot: appointmentsTable.selectedTimeSlot,
        calendarEventId: appointmentsTable.calendarEventId,
        status: appointmentsTable.status,
        appointmentSource: appointmentsTable.appointmentSource,
        patientAge: appointmentsTable.patientAge,
        patientGender: appointmentsTable.patientGender,
        visitType: appointmentsTable.visitType,
        notes: appointmentsTable.notes,
        doctorId: appointmentsTable.doctorId,
        createdAt: appointmentsTable.createdAt,
      })
      .from(appointmentsTable)
      .where(eq(appointmentsTable.clinicId, clinicId))
      .orderBy(desc(appointmentsTable.createdAt))
      .limit(5);

    const recentAppointments = recentAppointmentsRaw.map(serializeAppt);

    // Consolidated fields for Phase 5
    const clinic = await validateActiveClinicSubscription(clinicId);

    const subscription = clinic ? {
      id: clinic.id,
      planType: clinic.planType,
      subscriptionStatus: clinic.subscriptionStatus,
      startDate: clinic.startDate ? clinic.startDate.toISOString() : null,
      expiryDate: clinic.expiryDate ? clinic.expiryDate.toISOString() : null,
      lastPaymentReference: clinic.lastPaymentReference,
      subscriptionNotes: clinic.subscriptionNotes,
    } : null;

    const [settings] = await db
      .select({
        id: subscriptionSettingsTable.id,
        upiId: subscriptionSettingsTable.upiId,
        upiQrCodeUrl: subscriptionSettingsTable.upiQrCodeUrl,
        monthlyPrice: subscriptionSettingsTable.monthlyPrice,
        quarterlyPrice: subscriptionSettingsTable.quarterlyPrice,
        yearlyPrice: subscriptionSettingsTable.yearlyPrice,
        supportContact: subscriptionSettingsTable.supportContact,
        supportWhatsapp: subscriptionSettingsTable.supportWhatsapp,
      })
      .from(subscriptionSettingsTable)
      .limit(1);

    res.json(
      GetDashboardResponse.parse({
        clinic: clinic ? {
          id: clinic.id,
          name: clinic.name,
          planType: clinic.planType,
          subscriptionStatus: clinic.subscriptionStatus,
          expiryDate: clinic.expiryDate ? clinic.expiryDate.toISOString() : null,
        } : null,
        subscription,
        stats: {
          totalAppointments,
          todayAppointments,
          pendingCount,
          confirmedCount,
          completedCount,
          todayOnlineAppointments,
          todayManualAppointments,
          todayBlockedSlots,
          todayCompletedAppointments,
          todayCancelledAppointments,
        },
        recentAppointments,
        settings: settings || null,
      })
    );
  } catch (err) {
    console.error("Failed to load optimized dashboard data:", err);
    res.status(500).json({ error: "Failed to load dashboard data" });
  }
});

export default router;
