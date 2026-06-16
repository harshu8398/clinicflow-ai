import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, prescriptionsTable, medicineTemplatesTable } from "@workspace/db";
import { requireAuth, requireClinicOwnership } from "../middleware/auth";

const router: IRouter = Router();

// Standard default medicine templates in case the doctor hasn't defined custom ones yet
const DEFAULT_TEMPLATES = [
  {
    id: -1,
    name: "Paracetamol 650mg",
    dosage: "1 Tablet",
    frequency: "Morning - Afternoon - Night",
    duration: "5 Days",
    instructions: "After Food",
  },
  {
    id: -2,
    name: "Vitamin D",
    dosage: "1 Capsule",
    frequency: "Weekly",
    duration: "4 Weeks",
    instructions: "After Food",
  },
  {
    id: -3,
    name: "Amoxicillin",
    dosage: "1 Capsule",
    frequency: "Morning - Night",
    duration: "7 Days",
    instructions: "After Food",
  },
  {
    id: -4,
    name: "Pantoprazole",
    dosage: "1 Tablet",
    frequency: "Morning",
    duration: "10 Days",
    instructions: "Empty Stomach",
  }
];

// Create or update prescription for a specific appointment
router.post(
  "/clinics/:clinicId/appointments/:appointmentId/prescription",
  requireAuth,
  requireClinicOwnership,
  async (req, res): Promise<void> => {
    const clinicId = Number(req.params.clinicId);
    const appointmentId = Number(req.params.appointmentId);
    const {
      patientName,
      patientPhone,
      diagnosis,
      chiefComplaint,
      medicines,
      additionalAdvice,
      followUpDate,
      doctorNotes,
    } = req.body;

    if (!patientName || !patientPhone || !medicines) {
      res.status(400).json({ error: "Missing required prescription fields" });
      return;
    }

    try {
      // Check if prescription already exists for this appointment
      const [existing] = await db
        .select()
        .from(prescriptionsTable)
        .where(
          and(
            eq(prescriptionsTable.appointmentId, appointmentId),
            eq(prescriptionsTable.clinicId, clinicId)
          )
        );

      const medicinesString = typeof medicines === "string" ? medicines : JSON.stringify(medicines);

      if (existing) {
        // Update
        const [updated] = await db
          .update(prescriptionsTable)
          .set({
            patientName,
            patientPhone,
            diagnosis,
            chiefComplaint,
            medicines: medicinesString,
            additionalAdvice,
            followUpDate,
            doctorNotes,
          })
          .where(eq(prescriptionsTable.id, existing.id))
          .returning();
        res.json(updated);
      } else {
        // Insert
        const [inserted] = await db
          .insert(prescriptionsTable)
          .values({
            clinicId,
            appointmentId,
            patientName,
            patientPhone,
            diagnosis,
            chiefComplaint,
            medicines: medicinesString,
            additionalAdvice,
            followUpDate,
            doctorNotes,
          })
          .returning();
        res.status(201).json(inserted);
      }
    } catch (err: any) {
      console.error("Failed to save prescription:", err);
      res.status(500).json({ error: err.message || "Failed to save prescription" });
    }
  }
);

// Get prescription for a specific appointment
router.get(
  "/clinics/:clinicId/appointments/:appointmentId/prescription",
  requireAuth,
  requireClinicOwnership,
  async (req, res): Promise<void> => {
    const clinicId = Number(req.params.clinicId);
    const appointmentId = Number(req.params.appointmentId);

    try {
      const [prescription] = await db
        .select()
        .from(prescriptionsTable)
        .where(
          and(
            eq(prescriptionsTable.appointmentId, appointmentId),
            eq(prescriptionsTable.clinicId, clinicId)
          )
        );

      if (!prescription) {
        res.status(404).json({ error: "No prescription found for this appointment" });
        return;
      }
      res.json(prescription);
    } catch (err: any) {
      console.error("Failed to fetch prescription:", err);
      res.status(500).json({ error: err.message || "Failed to fetch prescription" });
    }
  }
);

// Get prescription history for a patient (by phone number)
router.get(
  "/clinics/:clinicId/patients/:patientPhone/prescriptions",
  requireAuth,
  requireClinicOwnership,
  async (req, res): Promise<void> => {
    const clinicId = Number(req.params.clinicId);
    const patientPhone = req.params.patientPhone as string;

    try {
      const history = await db
        .select()
        .from(prescriptionsTable)
        .where(
          and(
            eq(prescriptionsTable.patientPhone, patientPhone),
            eq(prescriptionsTable.clinicId, clinicId)
          )
        )
        .orderBy(prescriptionsTable.createdAt);

      res.json(history);
    } catch (err: any) {
      console.error("Failed to fetch patient prescriptions history:", err);
      res.status(500).json({ error: err.message || "Failed to fetch patient prescriptions history" });
    }
  }
);

// Get medicine templates for a clinic
router.get(
  "/clinics/:clinicId/medicine-templates",
  requireAuth,
  requireClinicOwnership,
  async (req, res): Promise<void> => {
    const clinicId = Number(req.params.clinicId);

    try {
      const templates = await db
        .select()
        .from(medicineTemplatesTable)
        .where(eq(medicineTemplatesTable.clinicId, clinicId))
        .orderBy(medicineTemplatesTable.createdAt);

      // Merge user custom templates with the standard default list
      res.json([...DEFAULT_TEMPLATES, ...templates]);
    } catch (err: any) {
      console.error("Failed to fetch medicine templates:", err);
      res.status(500).json({ error: err.message || "Failed to fetch medicine templates" });
    }
  }
);

// Create custom medicine template for a clinic
router.post(
  "/clinics/:clinicId/medicine-templates",
  requireAuth,
  requireClinicOwnership,
  async (req, res): Promise<void> => {
    const clinicId = Number(req.params.clinicId);
    const { name, dosage, frequency, duration, instructions } = req.body;

    if (!name) {
      res.status(400).json({ error: "Medicine name is required for templates" });
      return;
    }

    try {
      const [inserted] = await db
        .insert(medicineTemplatesTable)
        .values({
          clinicId,
          name,
          dosage,
          frequency,
          duration,
          instructions,
        })
        .returning();
      res.status(201).json(inserted);
    } catch (err: any) {
      console.error("Failed to save template:", err);
      res.status(500).json({ error: err.message || "Failed to save template" });
    }
  }
);

export default router;
