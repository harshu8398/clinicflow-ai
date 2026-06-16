import { db, clinicsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const getRedirectUri = (clinicId: number) =>
  `http://localhost:5000/api/clinics/1/auth/google/callback`;

export function getAuthUrl(clinicId: number): string {
  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const options = {
    redirect_uri: getRedirectUri(clinicId),
    client_id: process.env.GOOGLE_CLIENT_ID!,
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    state: String(clinicId),
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/userinfo.email"
    ].join(" ")
  };
  const qs = new URLSearchParams(options);
  return `${rootUrl}?${qs.toString()}`;
}

export async function getTokensFromCode(code: string, clinicId: number) {
  const url = "https://oauth2.googleapis.com/token";
  const values = {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: getRedirectUri(clinicId),
    grant_type: "authorization_code"
  };
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values).toString()
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch Google OAuth tokens: ${text}`);
  }
  return (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };
}

export async function getUserEmail(accessToken: string): Promise<string> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch Google userinfo: ${text}`);
  }
  const data = (await response.json()) as { email: string };
  return data.email;
}

export async function refreshAccessToken(refreshToken: string) {
  const url = "https://oauth2.googleapis.com/token";
  const values = {
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  };
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values).toString()
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to refresh Google OAuth token: ${text}`);
  }
  return (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
}

export async function getValidAccessToken(clinic: typeof clinicsTable.$inferSelect): Promise<string> {
  if (!clinic.googleAccessToken || !clinic.googleRefreshToken) {
    throw new Error("Google Calendar is not connected");
  }
  const buffer = 5 * 60 * 1000;
  const isExpired = clinic.googleTokenExpiresAt
    ? new Date().getTime() + buffer > new Date(clinic.googleTokenExpiresAt).getTime()
    : true;

  if (isExpired) {
    const refreshed = await refreshAccessToken(clinic.googleRefreshToken);
    const expiresAt = new Date(new Date().getTime() + refreshed.expires_in * 1000);

    await db
      .update(clinicsTable)
      .set({
        googleAccessToken: refreshed.access_token,
        googleTokenExpiresAt: expiresAt
      })
      .where(eq(clinicsTable.id, clinic.id));

    return refreshed.access_token;
  }
  return clinic.googleAccessToken;
}

export async function getBusySlots(
  accessToken: string,
  calendarId: string,
  dateStr: string
): Promise<Array<{ start: string; end: string }>> {
  const dateOnly = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  const url = "https://www.googleapis.com/calendar/v3/freeBusy";
  const timeMin = new Date(`${dateOnly}T00:00:00Z`).toISOString();
  const timeMax = new Date(`${dateOnly}T23:59:59Z`).toISOString();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: calendarId }]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch freebusy data: ${text}`);
  }

  const data = (await response.json()) as {
    calendars: Record<string, { busy: Array<{ start: string; end: string }> }>;
  };

  return data.calendars[calendarId]?.busy || [];
}

export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventDetails: { summary: string; description: string; start: string; end: string }
): Promise<string> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      summary: eventDetails.summary,
      description: eventDetails.description,
      start: { dateTime: eventDetails.start },
      end: { dateTime: eventDetails.end }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create calendar event: ${text}`);
  }

  const data = (await response.json()) as { id: string };
  return data.id;
}

export async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  eventDetails: { summary: string; description: string; start: string; end: string }
): Promise<void> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      summary: eventDetails.summary,
      description: eventDetails.description,
      start: { dateTime: eventDetails.start },
      end: { dateTime: eventDetails.end }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update calendar event: ${text}`);
  }
}

export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok && response.status !== 410 && response.status !== 404) {
    const text = await response.text();
    throw new Error(`Failed to delete calendar event: ${text}`);
  }
}

export async function getCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<{
  summary: string;
  description: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
}> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const text = await response.text();
    const err: any = new Error(`Failed to fetch calendar event: ${text}`);
    err.status = response.status;
    throw err;
  }

  return response.json() as any;
}
