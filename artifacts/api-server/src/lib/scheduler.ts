import { db, appointmentsTable, clinicsTable, blockedSlotsTable, blockedDaysTable } from "@workspace/db";
import { and, eq, ne } from "drizzle-orm";
import { getValidAccessToken, getBusySlots } from "./google-calendar";

export function parseTimeToDate(dateStr: string, timeStr: string, timeZone: string = "Asia/Kolkata"): Date {
  let cleanTime = timeStr.trim();
  let hours = 0;
  let minutes = 0;

  if (cleanTime.toUpperCase().includes("AM") || cleanTime.toUpperCase().includes("PM")) {
    const [time, modifier] = cleanTime.split(" ");
    const parts = time.split(":");
    let h = parseInt(parts[0] || "0", 10);
    const m = parseInt(parts[1] || "00", 10);
    if (h === 12) {
      h = 0;
    }
    if (modifier.toUpperCase() === "PM") {
      h += 12;
    }
    hours = h;
    minutes = m;
  } else {
    const parts = cleanTime.split(":");
    const h = parseInt(parts[0] || "0", 10);
    const m = parseInt(parts[1] || "00", 10);
    hours = h;
    minutes = m;
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(utcGuess);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const formattedYear = parseInt(partMap.year || "1970", 10);
  const formattedMonth = parseInt(partMap.month || "1", 10);
  const formattedDay = parseInt(partMap.day || "1", 10);
  const formattedHour = parseInt(partMap.hour || "0", 10);
  const formattedMin = parseInt(partMap.minute || "0", 10);

  const formattedLocalUTC = new Date(Date.UTC(
    formattedYear,
    formattedMonth - 1,
    formattedDay,
    formattedHour,
    formattedMin,
    0
  ));

  const offsetMs = formattedLocalUTC.getTime() - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offsetMs);
}

export async function calculateAvailableSlots(clinicId: number, dateStr: string): Promise<string[]> {
  if (!dateStr) return [];
  const dateOnly = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  if (isNaN(new Date(dateOnly).getTime())) {
    return [];
  }

  // Check if the entire day is blocked
  const [blockedDay] = await db
    .select()
    .from(blockedDaysTable)
    .where(
      and(
        eq(blockedDaysTable.clinicId, clinicId),
        eq(blockedDaysTable.date, dateOnly)
      )
    )
    .limit(1);

  if (blockedDay) {
    return [];
  }

  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId));
  if (!clinic) {
    throw new Error("Clinic not found");
  }

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
      const slotStart = parseTimeToDate(dateOnly, `${hourStr}:${minStr}`, "Asia/Kolkata");
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

  // Fetch blocked slots for this date
  const blockedSlots = await db
    .select()
    .from(blockedSlotsTable)
    .where(
      and(
        eq(blockedSlotsTable.clinicId, clinicId),
        eq(blockedSlotsTable.date, dateOnly)
      )
    );

  const parsedBlockedSlots = blockedSlots
    .map(b => ({
      start: parseTimeToDate(dateOnly, b.startTime),
      end: parseTimeToDate(dateOnly, b.endTime)
    }))
    .filter(b => !isNaN(b.start.getTime()) && !isNaN(b.end.getTime()));

  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }
  const todayStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
  const isToday = dateOnly === todayStr;

  const available = potentialSlots.filter(slot => {
    if (isToday && slot.start < now) {
      return false;
    }

    if (bookedSlots.has(slot.label)) {
      return false;
    }

    const hasBlockConflict = parsedBlockedSlots.some(block => {
      return slot.start < block.end && slot.end > block.start;
    });

    if (hasBlockConflict) {
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

export function formatToLocalISO(date: Date, timeZone: string = "Asia/Kolkata"): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }
  return `${partMap.year}-${partMap.month}-${partMap.day}T${partMap.hour}:${partMap.minute}:${partMap.second}`;
}
