import { db, appointmentsTable, clinicsTable } from "@workspace/db";
import { and, eq, ne } from "drizzle-orm";
import { getValidAccessToken, getBusySlots } from "./google-calendar";

export async function calculateAvailableSlots(clinicId: number, dateStr: string): Promise<string[]> {
  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId));
  if (!clinic) {
    throw new Error("Clinic not found");
  }

  const dateOnly = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayOfWeek = days[new Date(dateOnly).getUTCDay()];
  const activeDays = clinic.workingDays
    ? clinic.workingDays.split(",").map(d => d.trim().toLowerCase())
    : ["monday", "tuesday", "wednesday", "thursday", "friday"];

  if (!activeDays.includes(dayOfWeek)) {
    return [];
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

  const bookedSlots = new Set(
    existingAppts
      .map(appt => appt.selectedTimeSlot)
      .filter((slot): slot is string => !!slot)
  );

  let googleBusyRanges: Array<{ start: Date; end: Date }> = [];
  if (clinic.googleConnected && clinic.googleCalendarId) {
    try {
      const token = await getValidAccessToken(clinic);
      const busy = await getBusySlots(token, clinic.googleCalendarId, dateOnly);
      googleBusyRanges = busy.map(b => ({
        start: new Date(b.start),
        end: new Date(b.end)
      }));
    } catch (err) {
      console.error("Failed to fetch Google Calendar busy slots:", err);
    }
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;
  const isToday = dateOnly === todayStr;

  const available = potentialSlots.filter(slot => {
    if (isToday && slot.start < now) {
      return false;
    }

    if (bookedSlots.has(slot.label)) {
      return false;
    }

    const hasGoogleConflict = googleBusyRanges.some(range => {
      return slot.start < range.end && slot.end > range.start;
    });

    if (hasGoogleConflict) {
      return false;
    }

    return true;
  });

  return available.map(s => s.label);
}

function format12Hour(hours: number, minutes: number): string {
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = minutes.toString().padStart(2, "0");
  const displayHoursStr = displayHours.toString().padStart(2, "0");
  return `${displayHoursStr}:${displayMinutes} ${ampm}`;
}
