const email = "harsh.jha2024@vitstudent.ac.in";
const password = "admin123";
const baseUrl = "http://localhost:5000/api";
const date = "2026-07-02";

async function run() {
  console.log("Logging in...");
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!loginRes.ok) throw new Error("Login failed");
  const loginData = await loginRes.json();
  const cookie = loginRes.headers.get("set-cookie");
  const headers = { "Content-Type": "application/json", Cookie: cookie || "" };
  const clinicId = loginData.clinicId;

  console.log(`Clinic ID: ${clinicId}`);

  // Fetch initial slots
  const initRes = await fetch(`${baseUrl}/clinics/${clinicId}/slots?date=${date}`, { headers });
  const initSlots = await initRes.json();
  console.log(`Initial available slots count: ${initSlots.length}`);

  // ==========================================
  // CASE 1: Blocked 09:00 - 12:00
  // ==========================================
  console.log("\n--- TEST CASE 1: Blocked 09:00 - 12:00 ---");
  const blockSlotRes = await fetch(`${baseUrl}/clinics/${clinicId}/blocked-slots`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      date,
      startTime: "9:00",
      endTime: "12:00",
      reason: "Case 1 Test",
    }),
  });
  const blockSlot = await blockSlotRes.json();
  console.log("Blocked slot created ID:", blockSlot.id);

  const slotsRes1 = await fetch(`${baseUrl}/clinics/${clinicId}/slots?date=${date}`, { headers });
  const slots1 = await slotsRes1.json();

  const blockedInterval = ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM"];
  const passesCase1 = blockedInterval.every(s => !slots1.includes(s)) && slots1.includes("12:00 PM");

  console.log("Slots in blocked range present?", blockedInterval.map(s => `${s}: ${slots1.includes(s)}`));
  console.log("Slot 12:00 PM present?", slots1.includes("12:00 PM"));
  console.log("Test Case 1 Passed:", passesCase1);

  // Cleanup block slot
  await fetch(`${baseUrl}/clinics/${clinicId}/blocked-slots/${blockSlot.id}`, { method: "DELETE", headers });

  // ==========================================
  // CASE 2: Blocked Entire Day
  // ==========================================
  console.log("\n--- TEST CASE 2: Blocked Entire Day ---");
  const blockDayRes = await fetch(`${baseUrl}/clinics/${clinicId}/blocked-days`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      date,
      reason: "Case 2 Test",
    }),
  });
  const blockDay = await blockDayRes.json();
  console.log("Blocked day created ID:", blockDay.id);

  const slotsRes2 = await fetch(`${baseUrl}/clinics/${clinicId}/slots?date=${date}`, { headers });
  const slots2 = await slotsRes2.json();

  const passesCase2 = Array.isArray(slots2) && slots2.length === 0;
  console.log("Available slots count for blocked day:", slots2.length);
  console.log("Test Case 2 Passed:", passesCase2);

  // Cleanup block day
  await fetch(`${baseUrl}/clinics/${clinicId}/blocked-days/${blockDay.id}`, { method: "DELETE", headers });

  // ==========================================
  // CASE 3: Manual Appointment at 11:30 AM
  // ==========================================
  console.log("\n--- TEST CASE 3: Manual Appointment at 11:30 AM ---");
  const apptRes3 = await fetch(`${baseUrl}/clinics/${clinicId}/appointments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      patientName: "Manual Test Patient",
      patientPhone: "9876543210",
      patientProblem: "Toothache",
      appointmentDate: date,
      selectedTimeSlot: "11:30 AM",
      appointmentSource: "Manual",
    }),
  });
  const appt3 = await apptRes3.json();
  console.log("Manual Appointment created:", appt3);

  const slotsRes3 = await fetch(`${baseUrl}/clinics/${clinicId}/slots?date=${date}`, { headers });
  const slots3 = await slotsRes3.json();

  const passesCase3 = !slots3.includes("11:30 AM");
  console.log("Slot 11:30 AM present in slots list?", slots3.includes("11:30 AM"));
  console.log("Test Case 3 Passed:", passesCase3);

  // Cleanup manual appointment
  if (appt3.id) {
    await fetch(`${baseUrl}/clinics/${clinicId}/appointments/${appt3.id}`, { method: "DELETE", headers });
  }

  // ==========================================
  // CASE 4: Online Appointment at 02:00 PM
  // ==========================================
  console.log("\n--- TEST CASE 4: Online Appointment at 02:00 PM ---");
  const apptRes4 = await fetch(`${baseUrl}/clinics/${clinicId}/appointments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      patientName: "Online Test Patient",
      patientPhone: "9876543210",
      patientProblem: "Checkup",
      appointmentDate: date,
      selectedTimeSlot: "02:00 PM",
      appointmentSource: "Online",
    }),
  });
  const appt4 = await apptRes4.json();
  console.log("Online Appointment created:", appt4);

  const slotsRes4 = await fetch(`${baseUrl}/clinics/${clinicId}/slots?date=${date}`, { headers });
  const slots4 = await slotsRes4.json();

  const passesCase4 = !slots4.includes("02:00 PM");
  console.log("Slot 02:00 PM present in slots list?", slots4.includes("02:00 PM"));
  console.log("Test Case 4 Passed:", passesCase4);

  // Cleanup online appointment
  if (appt4.id) {
    await fetch(`${baseUrl}/clinics/${clinicId}/appointments/${appt4.id}`, { method: "DELETE", headers });
  }

  if (passesCase1 && passesCase2 && passesCase3 && passesCase4) {
    console.log("\nALL TEST CASES PASSED SUCCESSFULLY! 🎉✅");
  } else {
    console.error("\nSOME TEST CASES FAILED! ❌");
  }
}

run().catch(console.error);
