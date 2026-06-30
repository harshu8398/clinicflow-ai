import { db, clinicsTable, appointmentsTable } from '@workspace/db';
import { eq, and, ne } from 'drizzle-orm';

async function main() {
  const clinicId = 1;
  const dateStr = "2026-06-09";
  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId));
  if (!clinic) {
    console.log("Clinic not found");
    return;
  }

  const dateOnly = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  const dayOfWeek = new Date(dateOnly).toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  console.log("dateOnly:", dateOnly);
  console.log("dayOfWeek:", dayOfWeek);
  
  const activeDays = clinic.workingDays
    ? clinic.workingDays.split(",").map(d => d.trim().toLowerCase())
    : ["monday", "tuesday", "wednesday", "thursday", "friday"];
  console.log("activeDays:", activeDays);

  if (!activeDays.includes(dayOfWeek)) {
    console.log("Day not active. Returning []");
    return;
  }

  interface Session {
    start: string;
    end: string;
  }

  let sessions: Session[] = [];
  if (clinic.openingTime && clinic.openingTime.startsWith("[")) {
    try {
      sessions = JSON.parse(clinic.openingTime);
    } catch (e) {
      sessions = [];
    }
  }
  console.log("sessions:", sessions);

  if (sessions.length === 0) {
    sessions = [
      {
        start: clinic.openingTime || "09:00",
        end: clinic.closingTime || "17:00"
      }
    ];
  }

  const duration = clinic.slotDuration || 30;
  const potentialSlots: Array<{ label: string; start: Date; end: Date }> = [];

  function format12Hour(hours: number, minutes: number): string {
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    const displayMinutes = minutes.toString().padStart(2, "0");
    const displayHoursStr = displayHours.toString().padStart(2, "0");
    return `${displayHoursStr}:${displayMinutes} ${ampm}`;
  }

  for (const session of sessions) {
    const [startHour, startMin] = session.start.split(":").map(Number);
    const [endHour, endMin] = session.end.split(":").map(Number);

    const totalStartMinutes = startHour * 60 + startMin;
    const totalEndMinutes = endHour * 60 + endMin;

    for (let mins = totalStartMinutes; mins + duration <= totalEndMinutes; mins += duration) {
      const slotHour = Math.floor(mins / 60);
      const slotMin = mins % 60;

      const label = format12Hour(slotHour, slotMin);

      const hourStr = slotHour.toString().padStart(2, "0");
      const minStr = slotMin.toString().padStart(2, "0");
      const slotStart = new Date(`${dateOnly}T${hourStr}:${minStr}:00`);
      const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);

      potentialSlots.push({ label, start: slotStart, end: slotEnd });
    }
  }
  console.log("potentialSlots:", potentialSlots.map(s => s.label));

  const existingAppts = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.clinicId, clinicId),
        eq(appointmentsTable.appointmentDate, dateOnly),
        ne(appointmentsTable.status, "cancelled")
      )
    );
  console.log("existingAppts count:", existingAppts.length);

  const bookedSlots = new Set(
    existingAppts
      .map(appt => appt.selectedTimeSlot)
      .filter((slot): slot is string => !!slot)
  );
  console.log("bookedSlots:", bookedSlots);

  let googleBusyRanges: Array<{ start: Date; end: Date }> = [];
  if (clinic.googleConnected && clinic.googleCalendarId) {
    console.log("Google Connected. Busy ranges check...");
  }

  // Check if there are google Busy Ranges
  // Wait, let's just see if we get past Google connection
  process.exit(0);
}

main().catch(console.error);
