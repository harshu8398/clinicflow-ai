import { db, appointmentsTable, clinicsTable } from "@workspace/db";
import { eq, and, ne, isNotNull } from "drizzle-orm";
import { getValidAccessToken, getCalendarEvent } from "./google-calendar";
import { logger } from "./logger";

function convertTo12Hour(hours: number, minutes: number): string {
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = minutes.toString().padStart(2, "0");
  const displayHoursStr = displayHours.toString().padStart(2, "0");
  return `${displayHoursStr}:${displayMinutes} ${ampm}`;
}

export async function syncAllClinicsGoogleCalendar() {
  try {
    const clinics = await db
      .select()
      .from(clinicsTable)
      .where(eq(clinicsTable.googleConnected, true));

    for (const clinic of clinics) {
      if (!clinic.googleCalendarId) continue;

      try {
        const token = await getValidAccessToken(clinic);

        const appointments = await db
          .select()
          .from(appointmentsTable)
          .where(
            and(
              eq(appointmentsTable.clinicId, clinic.id),
              isNotNull(appointmentsTable.calendarEventId),
              ne(appointmentsTable.status, "cancelled")
            )
          );

        for (const appt of appointments) {
          if (!appt.calendarEventId) continue;

          try {
            const event = await getCalendarEvent(token, clinic.googleCalendarId, appt.calendarEventId);
            if (!event.start || !event.start.dateTime) continue;

            const eventDate = new Date(event.start.dateTime);
            
            // Format to YYYY-MM-DD
            const year = eventDate.getFullYear();
            const month = (eventDate.getMonth() + 1).toString().padStart(2, "0");
            const day = eventDate.getDate().toString().padStart(2, "0");
            const googleDate = `${year}-${month}-${day}`;

            // Format to hh:mm AM/PM
            const googleTime = convertTo12Hour(eventDate.getHours(), eventDate.getMinutes());

            if (appt.appointmentDate !== googleDate || appt.selectedTimeSlot !== googleTime) {
              logger.info(
                {
                  appointmentId: appt.id,
                  oldDate: appt.appointmentDate,
                  oldTime: appt.selectedTimeSlot,
                  newDate: googleDate,
                  newTime: googleTime,
                },
                "Reschedule detected from Google Calendar. Updating system appointment."
              );

              // Update in DB
              await db
                .update(appointmentsTable)
                .set({
                  appointmentDate: googleDate,
                  selectedTimeSlot: googleTime,
                })
                .where(eq(appointmentsTable.id, appt.id));

              // Log notification to patient
              logger.info(
                {
                  patientPhone: appt.patientPhone,
                  patientName: appt.patientName,
                  message: `Hello ${appt.patientName}, your appointment with ${clinic.name} has been rescheduled to ${googleDate} at ${googleTime}.`,
                },
                "Patient notified of rescheduled appointment"
              );
            }
          } catch (err: any) {
            // If event was deleted, cancel appointment
            if (err.status === 404 || err.status === 410 || err.message?.includes("404") || err.message?.includes("410")) {
              logger.info(
                { appointmentId: appt.id },
                "Calendar event was deleted. Cancelling appointment in system."
              );
              await db
                .update(appointmentsTable)
                .set({ status: "cancelled", calendarEventId: null })
                .where(eq(appointmentsTable.id, appt.id));
            } else {
              logger.error({ err, appointmentId: appt.id }, "Error syncing individual appointment");
            }
          }
        }
      } catch (err) {
        logger.error({ err, clinicId: clinic.id }, "Error syncing calendar for clinic");
      }
    }
  } catch (err) {
    logger.error({ err }, "Error running syncAllClinicsGoogleCalendar");
  }
}

export function startGoogleSync() {
  // Run immediately on startup
  syncAllClinicsGoogleCalendar();
  // Poll every 15 seconds
  setInterval(syncAllClinicsGoogleCalendar, 15000);
}
