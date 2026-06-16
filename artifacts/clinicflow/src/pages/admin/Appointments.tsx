import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useListAppointments, useUpdateAppointmentStatus, useDeleteAppointment, getListAppointmentsQueryKey, useGetClinic } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { CalendarX2, Trash2, Loader2, Clock, Phone, Calendar as CalendarIcon, CheckCircle2, AlertCircle, Plus, Printer, Download, FileText, History, FileCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { jsPDF } from "jspdf";

type AppointmentStatus = "pending" | "pending_slot_selection" | "confirmed" | "booked" | "completed" | "cancelled";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  pending_slot_selection: "Awaiting Slot",
  confirmed: "Confirmed",
  booked: "Booked",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  pending_slot_selection: "bg-orange-100 text-orange-800 border-orange-200",
  confirmed: "bg-primary/10 text-primary border-primary/20",
  booked: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

export default function Appointments() {
  const { clinicId } = useParams();
  const id = Number(clinicId);
  const { data: appointments, isLoading } = useListAppointments(id);
  const appointmentsTyped = appointments as (any & { prescriptionGenerated?: boolean })[] | undefined;
  const { data: clinic } = useGetClinic(id);
  const updateStatus = useUpdateAppointmentStatus();
  const deleteAppointment = useDeleteAppointment();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlot, setRescheduleSlot] = useState("");
  const [rescheduleStatus, setRescheduleStatus] = useState<AppointmentStatus>("pending");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Prescription UI State
  const [activeTab, setActiveTab] = useState<"details" | "prescription" | "history">("details");
  const [prescription, setPrescription] = useState<any | null>(null);
  const [loadingPrescription, setLoadingPrescription] = useState(false);
  const [patientHistory, setPatientHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Medicine Templates State
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Prescription Form State
  const [isEditingPrescription, setIsEditingPrescription] = useState(false);
  const [prescriptionForm, setPrescriptionForm] = useState({
    diagnosis: "",
    chiefComplaint: "",
    medicines: [] as Array<{
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
      instructions: string;
    }>,
    additionalAdvice: "",
    followUpDate: "",
    doctorNotes: ""
  });

  // Fetch prescription, history, and templates when appointment is selected
  useEffect(() => {
    if (!selectedAppointment || !id) return;

    setPrescription(null);
    setIsEditingPrescription(false);

    // Fetch prescription for this appointment
    setLoadingPrescription(true);
    fetch(`/api/clinics/${id}/appointments/${selectedAppointment.id}/prescription`)
      .then((res) => {
        if (!res.ok) throw new Error("No prescription");
        return res.json();
      })
      .then((data) => {
        setPrescription(data);
        setLoadingPrescription(false);
      })
      .catch(() => {
        setPrescription(null);
        setLoadingPrescription(false);
      });

    // Fetch patient prescription history
    if (selectedAppointment.patientPhone) {
      setLoadingHistory(true);
      fetch(`/api/clinics/${id}/patients/${encodeURIComponent(selectedAppointment.patientPhone)}/prescriptions`)
        .then((res) => res.json())
        .then((data) => {
          setPatientHistory(Array.isArray(data) ? data : []);
          setLoadingHistory(false);
        })
        .catch(() => {
          setPatientHistory([]);
          setLoadingHistory(false);
        });
    }

    // Fetch templates
    setLoadingTemplates(true);
    fetch(`/api/clinics/${id}/medicine-templates`)
      .then((res) => res.json())
      .then((data) => {
        setTemplates(Array.isArray(data) ? data : []);
        setLoadingTemplates(false);
      })
      .catch(() => {
        setTemplates([]);
        setLoadingTemplates(false);
      });
  }, [selectedAppointment, id]);

  const addMedicineRow = () => {
    setPrescriptionForm((prev) => ({
      ...prev,
      medicines: [
        ...prev.medicines,
        { name: "", dosage: "", frequency: "", duration: "", instructions: "" }
      ]
    }));
  };

  const removeMedicineRow = (index: number) => {
    setPrescriptionForm((prev) => ({
      ...prev,
      medicines: prev.medicines.filter((_, i) => i !== index)
    }));
  };

  const updateMedicineRow = (index: number, field: string, value: string) => {
    setPrescriptionForm((prev) => {
      const newMeds = [...prev.medicines];
      newMeds[index] = { ...newMeds[index], [field]: value };
      return { ...prev, medicines: newMeds };
    });
  };

  const selectTemplateForMedicine = (index: number, template: any) => {
    setPrescriptionForm((prev) => {
      const newMeds = [...prev.medicines];
      newMeds[index] = {
        name: template.name || "",
        dosage: template.dosage || "",
        frequency: template.frequency || "",
        duration: template.duration || "",
        instructions: template.instructions || ""
      };
      return { ...prev, medicines: newMeds };
    });
  };

  const handleStartAddPrescription = () => {
    if (prescription) {
      let medsList = [];
      try {
        medsList = typeof prescription.medicines === "string" ? JSON.parse(prescription.medicines) : prescription.medicines;
      } catch {
        medsList = [];
      }
      setPrescriptionForm({
        diagnosis: prescription.diagnosis || "",
        chiefComplaint: prescription.chiefComplaint || "",
        medicines: medsList,
        additionalAdvice: prescription.additionalAdvice || "",
        followUpDate: prescription.followUpDate || "",
        doctorNotes: prescription.doctorNotes || ""
      });
    } else {
      setPrescriptionForm({
        diagnosis: "",
        chiefComplaint: "",
        medicines: [{ name: "", dosage: "", frequency: "", duration: "", instructions: "" }],
        additionalAdvice: "",
        followUpDate: "",
        doctorNotes: ""
      });
    }
    setIsEditingPrescription(true);
  };

  const handleSavePrescription = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment || !id) return;

    fetch(`/api/clinics/${id}/appointments/${selectedAppointment.id}/prescription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientName: selectedAppointment.patientName,
        patientPhone: selectedAppointment.patientPhone,
        ...prescriptionForm
      })
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to save");
        return res.json();
      })
      .then((data) => {
        setPrescription(data);
        setIsEditingPrescription(false);
        toast({ title: "Prescription saved successfully!" });
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey(id) });

        return fetch(`/api/clinics/${id}/patients/${encodeURIComponent(selectedAppointment.patientPhone)}/prescriptions`);
      })
      .then((res) => res?.json())
      .then((data) => {
        if (data) setPatientHistory(data);
      })
      .catch((err) => {
        console.error(err);
        toast({ title: "Failed to save prescription", variant: "destructive" });
      });
  };

  const handleSendPrescriptionWhatsApp = () => {
    if (!selectedAppointment || !clinic || !prescription) return;
    const phoneError = getPhoneValidationError(selectedAppointment.patientPhone);
    if (phoneError) {
      toast({ title: phoneError, variant: "destructive" });
      return;
    }

    const cleanPhone = selectedAppointment.patientPhone.replace(/\D/g, "");
    const prescDate = format(new Date(prescription.createdAt || new Date()), "dd MMMM yyyy");

    const message = `Hello ${selectedAppointment.patientName},

Your prescription is ready.

Clinic:
${clinic.clinicName || "Clinic"}

Doctor:
Dr. ${clinic.doctorName || "Doctor"}

Date:
${prescDate}

Please find your prescription attached/downloaded.

Thank you.`;

    const encodedText = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;
    window.open(whatsappUrl, "_blank");
  };

  const generatePrescriptionPDF = async (clinic: any, appointment: any, prescription: any, action: "download" | "print") => {
    const doc = new jsPDF();

    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Logo load failed"));
      });
    };

    // Top accent band
    doc.setFillColor(13, 148, 136);
    doc.rect(0, 0, 210, 5, "F");

    let y = 15;

    // Logo
    if (clinic.clinicLogo) {
      try {
        const logoImg = await loadImage(clinic.clinicLogo);
        doc.addImage(logoImg, "PNG", 15, y, 16, 16);
      } catch (e) {
        doc.setFillColor(13, 148, 136);
        doc.rect(15, y, 16, 16, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("+", 21, y + 11);
      }
    } else {
      doc.setFillColor(13, 148, 136);
      doc.rect(15, y, 16, 16, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("+", 21, y + 11);
    }

    // Header Text
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(clinic.clinicName || "Clinic", 35, y + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const docQual = clinic.doctorQualification ? ` | ${clinic.doctorQualification}` : "";
    const docSpec = clinic.doctorSpecialization ? ` | ${clinic.doctorSpecialization}` : "";
    doc.text(`Dr. ${clinic.doctorName || "Doctor"}${docQual}${docSpec}`, 35, y + 10);
    doc.text(`${clinic.address || ""} | Ph: ${clinic.clinicPhoneNumber || ""}`, 35, y + 14);

    y += 22;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, y, 195, y);

    // Patient Info Box
    y += 6;
    doc.setFillColor(248, 250, 252);
    doc.rect(15, y, 180, 24, "F");
    doc.setDrawColor(241, 245, 249);
    doc.rect(15, y, 180, 24, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);

    doc.text("PATIENT NAME:", 20, y + 8);
    doc.text("PHONE NUMBER:", 20, y + 16);
    doc.text("APPOINTMENT DATE:", 110, y + 8);
    doc.text("PRESCRIPTION DATE:", 110, y + 16);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(prescription.patientName || appointment.patientName || "N/A", 55, y + 8);
    doc.setFont("helvetica", "normal");
    doc.text(prescription.patientPhone || appointment.patientPhone || "N/A", 55, y + 16);

    const rawApptDate = appointment.appointmentDate || "";
    const cleanApptDate = rawApptDate.split("T")[0];
    const apptDateFormatted = (() => {
      try {
        return format(new Date(cleanApptDate + "T00:00:00"), "dd MMMM yyyy");
      } catch {
        return cleanApptDate;
      }
    })();
    doc.text(apptDateFormatted, 155, y + 8);

    const prescDateFormatted = format(new Date(prescription.createdAt || new Date()), "dd MMMM yyyy");
    doc.text(prescDateFormatted, 155, y + 16);

    // Complaint & Diagnosis
    y += 32;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(13, 148, 136);
    doc.text("CHIEF COMPLAINT", 15, y);
    doc.text("DIAGNOSIS", 110, y);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(prescription.chiefComplaint || "None reported", 15, y + 6);
    doc.text(prescription.diagnosis || "No diagnosis specified", 110, y + 6);

    // Medicines Table
    y += 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(13, 148, 136);
    doc.text("Rx - MEDICINES", 15, y);

    y += 5;
    doc.setFillColor(241, 245, 249);
    doc.rect(15, y, 180, 8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Medicine Name", 18, y + 5.5);
    doc.text("Dosage", 80, y + 5.5);
    doc.text("Frequency", 108, y + 5.5);
    doc.text("Duration", 143, y + 5.5);
    doc.text("Instructions", 168, y + 5.5);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);

    let medicinesList = [];
    try {
      medicinesList = typeof prescription.medicines === "string" ? JSON.parse(prescription.medicines) : prescription.medicines;
    } catch (e) {
      medicinesList = [];
    }

    medicinesList.forEach((med: any) => {
      doc.setFont("helvetica", "bold");
      doc.text(med.name || "", 18, y + 6);
      doc.setFont("helvetica", "normal");
      doc.text(med.dosage || "", 80, y + 6);
      doc.text(med.frequency || "", 108, y + 6);
      doc.text(med.duration || "", 143, y + 6);
      doc.text(med.instructions || "", 168, y + 6);

      doc.setDrawColor(241, 245, 249);
      doc.line(15, y + 9, 195, y + 9);
      y += 9;
    });

    // Advice & Notes
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(13, 148, 136);
    doc.text("ADDITIONAL ADVICE", 15, y);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(prescription.additionalAdvice || "None", 15, y + 6);

    y += 18;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(13, 148, 136);
    doc.text("DOCTOR NOTES", 15, y);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.text(prescription.doctorNotes || "None", 15, y + 6);

    // Follow-up
    if (prescription.followUpDate) {
      y += 18;
      doc.setFillColor(240, 253, 250);
      doc.rect(15, y, 180, 10, "F");
      doc.setDrawColor(204, 251, 241);
      doc.rect(15, y, 180, 10, "S");

      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 118, 110);
      const followUpFormatted = (() => {
        try {
          return format(new Date(prescription.followUpDate + "T00:00:00"), "dd MMMM yyyy");
        } catch {
          return prescription.followUpDate;
        }
      })();
      doc.text(`FOLLOW-UP DATE: ${followUpFormatted}`, 20, y + 6.5);
    }

    // Signature
    const footerY = 255;
    doc.setDrawColor(226, 232, 240);
    doc.line(15, footerY, 195, footerY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Dr. ${clinic.doctorName || "Doctor"}`, 15, footerY + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(clinic.doctorQualification || "", 15, footerY + 12);

    doc.setDrawColor(148, 163, 184);
    doc.line(145, footerY + 12, 195, footerY + 12);
    doc.text("Authorized Signature", 145, footerY + 17);

    if (action === "download") {
      doc.save(`Prescription-${appointment.patientName.replace(/\s+/g, "-")}-${appointment.id}.pdf`);
    } else if (action === "print") {
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = url;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow?.print();
      };
    }
  };

  const [successModalData, setSuccessModalData] = useState<{
    patientName: string;
    patientPhone: string;
    doctorName: string;
    clinicName: string;
    oldDate: string;
    oldTime: string;
    newDate: string;
    newTime: string;
  } | null>(null);

  const getPhoneValidationError = (phone: string | null | undefined) => {
    if (!phone || !phone.trim()) {
      return "Patient phone number is not available.";
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      return "Valid patient phone number required.";
    }
    return null;
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const cleanDate = dateStr.split("T")[0];
      const dateObj = new Date(cleanDate + "T00:00:00");
      return format(dateObj, "dd MMMM yyyy");
    } catch (e) {
      return dateStr;
    }
  };

  const handleWhatsAppNotify = () => {
    if (!successModalData) return;
    const { patientName, patientPhone, doctorName, oldDate, oldTime, newDate, newTime, clinicName } = successModalData;
    const cleanPhone = patientPhone.replace(/\D/g, "");
    
    const message = `Hello ${patientName},

Your appointment has been rescheduled.

Doctor:
${doctorName}

Previous Appointment:
${formatDateDisplay(oldDate)}
${oldTime}

New Appointment:
${formatDateDisplay(newDate)}
${newTime}

Please arrive 10 minutes before your appointment.

Thank you,
${clinicName}`;

    const encodedText = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;
    window.open(whatsappUrl, "_blank");
  };

  useEffect(() => {
    if (!rescheduleDate || !id) return;
    setLoadingSlots(true);
    fetch(`/api/clinics/${id}/slots?date=${rescheduleDate}`)
      .then(res => res.json())
      .then(data => {
        setSlots(Array.isArray(data) ? data : []);
        setLoadingSlots(false);
      })
      .catch(() => {
        setSlots([]);
        setLoadingSlots(false);
      });
  }, [rescheduleDate, id]);

  const handleRowClick = (apt: any, initialTab: "details" | "prescription" | "history" = "details") => {
    setSelectedAppointment(apt);
    const dateOnly = apt.appointmentDate ? apt.appointmentDate.split("T")[0] : "";
    setRescheduleDate(dateOnly);
    setRescheduleSlot(apt.selectedTimeSlot || "");
    setRescheduleStatus(apt.status);
    setActiveTab(initialTab);
  };

  const handleConfirmReschedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment) return;

    updateStatus.mutate(
      {
        clinicId: id,
        appointmentId: selectedAppointment.id,
        data: {
          status: rescheduleStatus,
          appointmentDate: rescheduleDate,
          selectedTimeSlot: rescheduleSlot || undefined,
        }
      },
      {
        onSuccess: () => {
          toast({ title: "Appointment updated and synced with calendar" });
          setSuccessModalData({
            patientName: selectedAppointment.patientName,
            patientPhone: selectedAppointment.patientPhone || "",
            doctorName: clinic?.doctorName || "Doctor",
            clinicName: clinic?.name || "Clinic",
            oldDate: selectedAppointment.appointmentDate ? selectedAppointment.appointmentDate.split("T")[0] : "",
            oldTime: selectedAppointment.selectedTimeSlot || "No slot assigned",
            newDate: rescheduleDate,
            newTime: rescheduleSlot || "No slot assigned",
          });
          setSelectedAppointment(null);
          queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey(id) });
        },
        onError: () => {
          toast({ title: "Failed to update appointment", variant: "destructive" });
        }
      }
    );
  };

  const handleDelete = (appointmentId: number) => {
    if (confirm("Are you sure you want to delete this appointment?")) {
      deleteAppointment.mutate(
        { clinicId: id, appointmentId },
        {
          onSuccess: () => {
            toast({ title: "Appointment deleted" });
            queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey(id) });
          }
        }
      );
    }
  };

  const isSameDay = (date1: Date, date2Str: string) => {
    if (!date2Str) return false;
    try {
      const d2Only = date2Str.includes("T") ? date2Str.split("T")[0] : date2Str;
      const d1Str = format(date1, "yyyy-MM-dd");
      return d1Str === d2Only;
    } catch (e) {
      return false;
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  // Filter appointments for the selected date
  const appointmentsForSelectedDate = appointmentsTyped?.filter(apt => 
    isSameDay(selectedDate, apt.appointmentDate)
  ) || [];

  // Filter daily appointments by status filter
  const filteredAppointmentsForSelectedDate = appointmentsForSelectedDate.filter(apt => 
    filter === "all" || apt.status === filter
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Calendar Card */}
        <div className="lg:col-span-5">
          <Card className="bg-white border-gray-100 shadow-sm overflow-hidden h-full flex flex-col">
            <CardHeader className="border-b border-gray-50 bg-gray-50/50">
              <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-primary" />
                Appointment Calendar
              </CardTitle>
              <p className="text-sm text-gray-500">Select a date to view and manage appointments</p>
            </CardHeader>
            <CardContent className="p-4 flex-1 flex items-center justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                className="w-full flex justify-center scale-105"
                modifiers={{
                  hasAppointment: (date) => {
                    return appointmentsTyped?.some(apt => isSameDay(date, apt.appointmentDate)) || false;
                  }
                }}
                modifiersClassNames={{
                  hasAppointment: "bg-primary/15 text-primary font-bold border-b-2 border-b-primary rounded-md"
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Appointments List */}
        <div className="lg:col-span-7">
          <Card className="bg-white border-gray-100 shadow-sm overflow-hidden h-full flex flex-col">
            <CardHeader className="border-b border-gray-50 bg-gray-50/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  Selected Date: {format(selectedDate, "dd MMMM yyyy")}
                </CardTitle>
                <p className="text-sm text-gray-500 mt-0.5">
                  {appointmentsForSelectedDate.length} appointment(s) scheduled
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-semibold">Filter:</span>
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending_slot_selection">Awaiting Slot</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="p-6 flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : filteredAppointmentsForSelectedDate.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center h-full min-h-[300px]">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <CalendarX2 className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">No appointments</h3>
                  <p className="text-xs text-gray-500 max-w-[250px]">
                    {appointmentsForSelectedDate.length === 0
                      ? "There are no appointments scheduled for this date."
                      : "No appointments match your status filter."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAppointmentsForSelectedDate.map((apt) => (
                    <div
                      key={apt.id}
                      className="p-4 border border-gray-100 hover:border-primary/30 hover:shadow-md cursor-pointer transition-all bg-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      onClick={() => handleRowClick(apt)}
                      data-testid={`row-appointment-${apt.id}`}
                    >
                      <div className="space-y-1">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-primary" />
                          {apt.patientName}
                        </h4>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            {apt.selectedTimeSlot || "No slot assigned"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                            {apt.patientPhone}
                          </span>
                        </div>
                        {apt.patientProblem && (
                          <p className="text-xs text-gray-600 mt-1 italic line-clamp-1">
                            "{apt.patientProblem}"
                          </p>
                        )}
                        
                        {/* Prescription Status Badge */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {apt.prescriptionGenerated ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              🟢 Prescription Generated
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                              🔴 Prescription Not Generated
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 justify-between sm:justify-end">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[apt.status] ?? STATUS_COLORS.pending}`}>
                          {STATUS_LABELS[apt.status] ?? apt.status}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-medium px-3 rounded-lg"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(apt);
                          }}
                          data-testid={`button-reschedule-${apt.id}`}
                        >
                          Reschedule
                        </Button>
                        {apt.status !== "cancelled" && (
                          <Button
                            variant={apt.prescriptionGenerated ? "outline" : "default"}
                            size="sm"
                            className={`h-8 text-xs font-semibold px-3 rounded-lg gap-1 ${
                              apt.prescriptionGenerated ? "border-green-300 text-green-700 hover:bg-green-50/50 hover:text-green-800" : ""
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(apt, "prescription");
                            }}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {apt.prescriptionGenerated ? "View Prescription" : "Add Prescription"}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-gray-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 rounded-lg"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(apt.id);
                          }}
                          disabled={deleteAppointment.isPending}
                          data-testid={`button-delete-${apt.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Appointment Edit & Slot Assignment Dialog */}
      {selectedAppointment && (
        <Dialog open={!!selectedAppointment} onOpenChange={(open) => !open && setSelectedAppointment(null)}>
          <DialogContent className={`transition-all duration-300 ${activeTab !== "details" ? "max-w-3xl" : "max-w-md"} bg-white rounded-2xl p-6 shadow-xl border border-gray-100`}>
            <DialogHeader className="pb-3 border-b border-gray-50 flex flex-row items-center justify-between">
              <DialogTitle className="text-lg font-bold text-gray-900">Appointment Details</DialogTitle>
            </DialogHeader>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-100 mb-4 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("details")}
                className={`pb-2 px-3 text-sm font-semibold transition-all border-b-2 ${
                  activeTab === "details"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                Appointment
              </button>

              {selectedAppointment.status !== "cancelled" && (
                <button
                  type="button"
                  onClick={() => setActiveTab("prescription")}
                  className={`pb-2 px-3 text-sm font-semibold transition-all border-b-2 ${
                    activeTab === "prescription"
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Prescription
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`pb-2 px-3 text-sm font-semibold transition-all border-b-2 ${
                  activeTab === "history"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                History
              </button>
            </div>

            {/* Tab 1: Details / Rescheduling */}
            {activeTab === "details" && (
              <form onSubmit={handleConfirmReschedule} className="space-y-5">
                <div className="bg-gray-50/70 rounded-xl p-4 border border-gray-100 space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Patient</span>
                    <span className="font-semibold text-gray-900">{selectedAppointment.patientName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phone</span>
                    <span className="font-semibold text-gray-900">{selectedAppointment.patientPhone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Reason</span>
                    <span className="font-semibold text-gray-900 text-right truncate max-w-[200px]" title={selectedAppointment.patientProblem}>
                      {selectedAppointment.patientProblem}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-gray-500">Prescription Status</span>
                    {prescription ? (
                      <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-150">
                        Generated
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                        Not Generated
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rescheduleStatus" className="text-xs text-gray-500 font-semibold">Appointment Status</Label>
                  <Select value={rescheduleStatus} onValueChange={(val) => setRescheduleStatus(val as AppointmentStatus)}>
                    <SelectTrigger id="rescheduleStatus" className="w-full text-xs h-10 border-gray-200">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending_slot_selection">Awaiting Slot</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="booked">Booked</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="rescheduleDate" className="text-xs text-gray-500 font-semibold">Select Date</Label>
                    <Input
                      id="rescheduleDate"
                      type="date"
                      value={rescheduleDate}
                      onChange={(e) => {
                        setRescheduleDate(e.target.value);
                        setRescheduleSlot("");
                      }}
                      className="text-xs h-10 border-gray-200 bg-transparent focus-visible:bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="rescheduleSlot" className="text-xs text-gray-500 font-semibold">Assign Time Slot</Label>
                    <Select
                      value={rescheduleSlot}
                      onValueChange={setRescheduleSlot}
                      disabled={loadingSlots || !rescheduleDate}
                    >
                      <SelectTrigger id="rescheduleSlot" className="w-full text-xs h-10 border-gray-200">
                        <SelectValue placeholder={loadingSlots ? "Loading..." : "Select Slot"} />
                      </SelectTrigger>
                      <SelectContent>
                        {slots.length === 0 ? (
                          <SelectItem value="_" disabled>
                            {rescheduleDate ? "No slots available" : "Select date first"}
                          </SelectItem>
                        ) : (
                          slots.map((slot) => (
                            <SelectItem key={slot} value={slot}>
                              {slot}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full text-xs font-semibold h-10 mt-2"
                  disabled={updateStatus.isPending || (rescheduleStatus === "confirmed" && !rescheduleSlot)}
                >
                  {updateStatus.isPending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
                  Confirm Updates
                </Button>
              </form>
            )}

            {activeTab === "details" && selectedAppointment && selectedAppointment.status !== "cancelled" && (
              <div className="pt-3.5 mt-3.5 border-t border-gray-100 space-y-2.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Prescription Quick Actions</span>
                {prescription ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab("prescription")}
                      className="text-xs h-9 border-primary/30 text-primary hover:bg-primary/5 gap-1.5 font-semibold col-span-2 justify-center"
                    >
                      <FileText className="w-4 h-4" /> View Prescription
                    </Button>
                    <Button
                      type="button"
                      onClick={() => generatePrescriptionPDF(clinic, selectedAppointment, prescription, "download")}
                      className="text-xs h-9 font-semibold gap-1.5 justify-center"
                    >
                      <Download className="w-3.5 h-3.5" /> Download PDF
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => generatePrescriptionPDF(clinic, selectedAppointment, prescription, "print")}
                      className="text-xs h-9 font-semibold gap-1.5 justify-center"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print
                    </Button>
                    
                    {(() => {
                      const phoneError = getPhoneValidationError(selectedAppointment.patientPhone);
                      return (
                        <Button
                          type="button"
                          onClick={handleSendPrescriptionWhatsApp}
                          disabled={!!phoneError}
                          className="text-xs h-9 bg-[#25D366] hover:bg-[#20ba56] text-white shadow-sm hover:shadow-md transition-all rounded-xl flex items-center justify-center gap-1.5 font-bold col-span-2 disabled:opacity-50 disabled:pointer-events-none"
                        >
                          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg> Send on WhatsApp
                        </Button>
                      );
                    })()}
                  </div>
                ) : (
                  <Button
                    type="button"
                    onClick={handleStartAddPrescription}
                    className="w-full text-xs font-semibold h-10 gap-1.5 justify-center"
                  >
                    <Plus className="w-4 h-4" /> Add Prescription
                  </Button>
                )}
              </div>
            )}

            {/* Tab 2: Prescription Manager */}
            {activeTab === "prescription" && (
              <div className="space-y-4">
                {loadingPrescription ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : isEditingPrescription ? (
                  <form onSubmit={handleSavePrescription} className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="diag" className="text-xs text-gray-500 font-semibold">Diagnosis</Label>
                        <Input
                          id="diag"
                          value={prescriptionForm.diagnosis}
                          onChange={(e) => setPrescriptionForm({ ...prescriptionForm, diagnosis: e.target.value })}
                          className="h-10 border-gray-200 text-xs"
                          placeholder="e.g. Acute Tonsillitis"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="complaint" className="text-xs text-gray-500 font-semibold">Chief Complaint</Label>
                        <Input
                          id="complaint"
                          value={prescriptionForm.chiefComplaint}
                          onChange={(e) => setPrescriptionForm({ ...prescriptionForm, chiefComplaint: e.target.value })}
                          className="h-10 border-gray-200 text-xs"
                          placeholder="e.g. Sore throat, high fever"
                        />
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                        <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">Rx - Medicines</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addMedicineRow}
                          className="h-7 text-[11px] border-dashed text-primary border-primary/20 hover:bg-primary/5 px-2.5"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Add Medicine
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {prescriptionForm.medicines.map((med, index) => (
                          <div key={index} className="p-3 bg-gray-50/50 border border-gray-150 rounded-xl space-y-3">
                            <div className="grid grid-cols-12 gap-2">
                              <div className="col-span-12 md:col-span-4 space-y-1">
                                <Label className="text-[9px] text-gray-400 font-bold uppercase">Name</Label>
                                <Input
                                  value={med.name}
                                  onChange={(e) => updateMedicineRow(index, "name", e.target.value)}
                                  placeholder="Medicine Name (e.g. Paracetamol)"
                                  className="h-8 text-xs border-gray-200 bg-white"
                                  required
                                />
                              </div>
                              <div className="col-span-4 md:col-span-2 space-y-1">
                                <Label className="text-[9px] text-gray-400 font-bold uppercase">Dosage</Label>
                                <Input
                                  value={med.dosage}
                                  onChange={(e) => updateMedicineRow(index, "dosage", e.target.value)}
                                  placeholder="e.g. 1 Tab"
                                  className="h-8 text-xs border-gray-200 bg-white"
                                />
                              </div>
                              <div className="col-span-4 md:col-span-3 space-y-1">
                                <Label className="text-[9px] text-gray-400 font-bold uppercase">Frequency</Label>
                                <Input
                                  value={med.frequency}
                                  onChange={(e) => updateMedicineRow(index, "frequency", e.target.value)}
                                  placeholder="e.g. 1-0-1"
                                  className="h-8 text-xs border-gray-200 bg-white"
                                />
                              </div>
                              <div className="col-span-4 md:col-span-3 space-y-1">
                                <Label className="text-[9px] text-gray-400 font-bold uppercase">Duration</Label>
                                <Input
                                  value={med.duration}
                                  onChange={(e) => updateMedicineRow(index, "duration", e.target.value)}
                                  placeholder="e.g. 5 Days"
                                  className="h-8 text-xs border-gray-200 bg-white"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-12 gap-2 items-center">
                              <div className="col-span-8 md:col-span-7 space-y-1">
                                <Label className="text-[9px] text-gray-400 font-bold uppercase">Instructions</Label>
                                <Input
                                  value={med.instructions}
                                  onChange={(e) => updateMedicineRow(index, "instructions", e.target.value)}
                                  placeholder="e.g. After Food"
                                  className="h-8 text-xs border-gray-200 bg-white"
                                />
                              </div>
                              <div className="col-span-4 md:col-span-5 flex items-end justify-end gap-1.5 pt-4">
                                <Select
                                  value=""
                                  onValueChange={(val) => {
                                    const t = templates.find((item) => item.name === val);
                                    if (t) selectTemplateForMedicine(index, t);
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-[10px] border-gray-200 px-2.5 max-w-[120px] bg-white">
                                    <SelectValue placeholder="TEMPLATES" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {templates.map((t) => (
                                      <SelectItem key={t.id} value={t.name}>
                                        {t.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                {prescriptionForm.medicines.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeMedicineRow(index)}
                                    className="text-gray-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 rounded-lg shrink-0"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="advice" className="text-xs text-gray-500 font-semibold">Additional Advice</Label>
                      <textarea
                        id="advice"
                        value={prescriptionForm.additionalAdvice}
                        onChange={(e) => setPrescriptionForm({ ...prescriptionForm, additionalAdvice: e.target.value })}
                        className="flex min-h-[50px] w-full rounded-xl border border-gray-200 bg-transparent px-3 py-1.5 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        placeholder="e.g. Avoid cold drinks"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="followUp" className="text-xs text-gray-500 font-semibold">Follow-Up Date</Label>
                        <Input
                          id="followUp"
                          type="date"
                          value={prescriptionForm.followUpDate}
                          onChange={(e) => setPrescriptionForm({ ...prescriptionForm, followUpDate: e.target.value })}
                          className="h-10 border-gray-200 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="docNotes" className="text-xs text-gray-500 font-semibold">Doctor Notes (Internal)</Label>
                        <textarea
                          id="docNotes"
                          value={prescriptionForm.doctorNotes}
                          onChange={(e) => setPrescriptionForm({ ...prescriptionForm, doctorNotes: e.target.value })}
                          className="flex min-h-[50px] w-full rounded-xl border border-gray-200 bg-transparent px-3 py-1.5 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                          placeholder="e.g. Patient showed signs of dehydration"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button type="submit" className="flex-1 h-10 text-xs font-semibold">
                        Save Prescription
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsEditingPrescription(false)}
                        className="flex-1 h-10 text-xs font-semibold border-gray-200"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : prescription ? (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                    <div className="bg-gray-50/70 border border-gray-100 rounded-2xl p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-xs border-b border-gray-100 pb-3">
                        <div>
                          <span className="text-gray-400 font-semibold block uppercase tracking-wider text-[10px]">Diagnosis</span>
                          <span className="font-bold text-gray-900 mt-0.5 block">{prescription.diagnosis || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 font-semibold block uppercase tracking-wider text-[10px]">Chief Complaint</span>
                          <span className="font-bold text-gray-900 mt-0.5 block">{prescription.chiefComplaint || "N/A"}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Medicines (Rx)</span>
                        <div className="space-y-2">
                          {(() => {
                            let medsList = [];
                            try {
                              medsList = typeof prescription.medicines === "string" ? JSON.parse(prescription.medicines) : prescription.medicines;
                            } catch {
                              medsList = [];
                            }
                            return medsList.map((med: any, idx: number) => (
                              <div key={idx} className="bg-white rounded-xl p-3 border border-gray-100 text-xs space-y-1 shadow-sm">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-gray-900 text-sm">{med.name}</span>
                                  <span className="text-primary font-semibold">{med.dosage}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-gray-500 font-medium text-[10px] pt-1 border-t border-gray-50">
                                  <div>Freq: {med.frequency}</div>
                                  <div>Dur: {med.duration}</div>
                                  <div>Inst: {med.instructions}</div>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs border-t border-gray-100 pt-3">
                        <div>
                          <span className="text-gray-400 font-semibold block uppercase tracking-wider text-[10px]">Additional Advice</span>
                          <span className="font-semibold text-gray-800 mt-0.5 block whitespace-pre-wrap">{prescription.additionalAdvice || "None"}</span>
                        </div>
                        {prescription.followUpDate && (
                          <div>
                            <span className="text-gray-400 font-semibold block uppercase tracking-wider text-[10px]">Follow-Up Date</span>
                            <span className="font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded text-[11px] inline-block mt-1">
                              {(() => {
                                try {
                                  return format(new Date(prescription.followUpDate + "T00:00:00"), "dd MMMM yyyy");
                                } catch {
                                  return prescription.followUpDate;
                                }
                              })()}
                            </span>
                          </div>
                        )}
                      </div>

                      {prescription.doctorNotes && (
                        <div className="text-xs border-t border-gray-100 pt-3">
                          <span className="text-gray-400 font-semibold block uppercase tracking-wider text-[10px]">Doctor Notes (Internal)</span>
                          <span className="font-normal text-gray-600 mt-0.5 block italic">{prescription.doctorNotes}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {(() => {
                        const phoneError = getPhoneValidationError(selectedAppointment.patientPhone);
                        return (
                          <>
                            {phoneError && (
                              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2 text-amber-800">
                                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                <span className="text-xs font-semibold">{phoneError}</span>
                              </div>
                            )}

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                              <Button
                                onClick={() => generatePrescriptionPDF(clinic, selectedAppointment, prescription, "download")}
                                className="text-xs h-10 rounded-xl flex items-center justify-center gap-1.5 font-semibold"
                              >
                                <Download className="w-3.5 h-3.5" /> Download PDF
                              </Button>
                              <Button
                                onClick={() => generatePrescriptionPDF(clinic, selectedAppointment, prescription, "print")}
                                className="text-xs h-10 rounded-xl flex items-center justify-center gap-1.5 font-semibold"
                                variant="secondary"
                              >
                                <Printer className="w-3.5 h-3.5" /> Print
                              </Button>
                              <Button
                                onClick={handleSendPrescriptionWhatsApp}
                                disabled={!!phoneError}
                                className="text-xs h-10 bg-[#25D366] hover:bg-[#20ba56] text-white shadow-sm hover:shadow-md transition-all rounded-xl flex items-center justify-center gap-1.5 font-bold disabled:opacity-50 disabled:pointer-events-none"
                              >
                                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg> WhatsApp
                              </Button>
                              <Button
                                onClick={handleStartAddPrescription}
                                className="text-xs h-10 rounded-xl flex items-center justify-center gap-1.5 font-semibold"
                                variant="outline"
                              >
                                Edit Prescription
                              </Button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 border border-dashed border-gray-200 rounded-2xl">
                    <span className="text-xs text-gray-500 mb-4 font-semibold">No prescription created yet for this appointment.</span>
                    <Button onClick={handleStartAddPrescription} className="text-xs h-9 font-semibold rounded-lg px-4 gap-1.5">
                      <Plus className="w-4 h-4" /> Add Prescription
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Patient Prescription History */}
            {activeTab === "history" && (
              <div className="space-y-4">
                {loadingHistory ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : patientHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 border border-dashed border-gray-200 rounded-2xl">
                    <span className="text-xs text-gray-500">No previous prescriptions found for this patient.</span>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                    {patientHistory.map((histPresc) => (
                      <div key={histPresc.id} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-md">
                            {format(new Date(histPresc.createdAt), "dd MMMM yyyy")}
                          </span>
                          <span className="text-xs font-medium text-teal-600 bg-teal-50 px-2 py-0.5 rounded">
                            {histPresc.followUpDate ? `Follow-Up: ${formatDateDisplay(histPresc.followUpDate)}` : "No Follow-Up"}
                          </span>
                        </div>

                        <div className="text-xs space-y-1">
                          <div>
                            <span className="text-gray-400 font-semibold">Diagnosis:</span>{" "}
                            <span className="font-semibold text-gray-800">{histPresc.diagnosis || "N/A"}</span>
                          </div>
                          <div className="mt-2">
                            <span className="text-gray-400 font-semibold block">Medicines (Rx):</span>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {(() => {
                                let medsList = [];
                                try {
                                  medsList = typeof histPresc.medicines === "string" ? JSON.parse(histPresc.medicines) : histPresc.medicines;
                                } catch {
                                  medsList = [];
                                }
                                return medsList.map((m: any, i: number) => (
                                  <span key={i} className="text-[10px] font-bold text-slate-700 bg-slate-100/70 border border-slate-200/50 px-2 py-0.5 rounded-md font-sans">
                                    {m.name} ({m.dosage})
                                  </span>
                                ));
                              })()}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2 justify-end">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setPrescription(histPresc);
                              setActiveTab("prescription");
                            }}
                            className="h-8 text-xs font-semibold rounded-lg px-3 gap-1"
                          >
                            <FileText className="w-3.5 h-3.5" /> View Details
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => generatePrescriptionPDF(clinic, selectedAppointment, histPresc, "download")}
                            className="h-8 text-xs font-semibold rounded-lg px-3 gap-1"
                          >
                            <Download className="w-3.5 h-3.5" /> Download PDF
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Success Modal */}
      {successModalData && (
        <Dialog open={!!successModalData} onOpenChange={(open) => !open && setSuccessModalData(null)}>
          <DialogContent className="max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <DialogHeader className="pb-4 border-b border-gray-100">
              <DialogTitle className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                Appointment Rescheduled Successfully
              </DialogTitle>
            </DialogHeader>

            <div className="py-4 space-y-6">
              {/* Success Indicators */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5 text-sm text-emerald-700 font-medium bg-emerald-50/70 px-3.5 py-2.5 rounded-xl border border-emerald-100/50">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>Appointment Updated Successfully</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-emerald-700 font-medium bg-emerald-50/70 px-3.5 py-2.5 rounded-xl border border-emerald-100/50">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>Google Calendar Updated Successfully</span>
                </div>
              </div>

              {/* Appointment details */}
              <div className="bg-gray-50/80 rounded-2xl p-5 border border-gray-100/70 space-y-4">
                <div className="grid grid-cols-3 gap-2 py-0.5 border-b border-gray-100/50 pb-3">
                  <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Patient</span>
                  <span className="col-span-2 text-sm font-bold text-gray-900">{successModalData.patientName}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-0.5 border-b border-gray-100/50 pb-3">
                  <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Doctor</span>
                  <span className="col-span-2 text-sm font-semibold text-gray-800">{successModalData.doctorName}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-0.5">
                  <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider mt-0.5">New Appointment</span>
                  <div className="col-span-2 space-y-1">
                    <div className="text-sm font-bold text-primary flex items-center gap-1.5">
                      <CalendarIcon className="w-4 h-4" />
                      {formatDateDisplay(successModalData.newDate)}
                    </div>
                    <div className="text-sm font-bold text-primary flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {successModalData.newTime}
                    </div>
                  </div>
                </div>
              </div>

              {/* Validation & Actions */}
              <div className="space-y-3 pt-2">
                {(() => {
                  const phoneError = getPhoneValidationError(successModalData.patientPhone);
                  return (
                    <>
                      {phoneError && (
                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2 text-amber-800">
                          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <span className="text-xs font-semibold">{phoneError}</span>
                        </div>
                      )}
                      
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          onClick={handleWhatsAppNotify}
                          disabled={!!phoneError}
                          className="flex-1 text-xs font-bold h-11 bg-[#25D366] hover:bg-[#20ba56] text-white shadow-md hover:shadow-lg transition-all rounded-xl gap-2 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                        >
                          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          Notify on WhatsApp
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setSuccessModalData(null)}
                          className="flex-1 text-xs font-semibold h-11 border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl"
                        >
                          Close
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
