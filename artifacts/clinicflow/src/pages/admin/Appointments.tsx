import { useState, useEffect } from "react";
import { useParams } from "wouter";
import {
  useListAppointments,
  useUpdateAppointmentStatus,
  useDeleteAppointment,
  getListAppointmentsQueryKey,
  useGetClinic,
  useListBlockedSlots,
  useCreateBlockedSlot,
  useDeleteBlockedSlot,
  useListBlockedDays,
  useCreateBlockedDay,
  useDeleteBlockedDay,
  useCreateAppointment
} from "@workspace/api-client-react";
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

  // Dialog Open States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBlockSlotOpen, setIsBlockSlotOpen] = useState(false);
  const [isBlockDayOpen, setIsBlockDayOpen] = useState(false);

  // Add Appointment Form State
  const [addForm, setAddForm] = useState({
    patientName: "",
    patientPhone: "",
    patientProblem: "",
    appointmentDate: "",
    selectedTimeSlot: "",
    appointmentSource: "Manual",
    patientAge: "",
    patientGender: "male",
    visitType: "New Consultation",
    notes: ""
  });

  // Block Slot Form State
  const [blockSlotForm, setBlockSlotForm] = useState({
    date: "",
    startTime: "",
    endTime: "",
    reason: ""
  });

  // Block Day Form State
  const [blockDayForm, setBlockDayForm] = useState({
    date: "",
    reason: ""
  });

  // Available Slots for Manual Booking
  const [manualSlots, setManualSlots] = useState<string[]>([]);
  const [loadingManualSlots, setLoadingManualSlots] = useState(false);

  // Queries & Mutations using api-client-react
  const createAppointmentMutation = useCreateAppointment();
  const createBlockedSlotMutation = useCreateBlockedSlot();
  const deleteBlockedSlotMutation = useDeleteBlockedSlot();
  const createBlockedDayMutation = useCreateBlockedDay();
  const deleteBlockedDayMutation = useDeleteBlockedDay();

  const { data: blockedSlots, refetch: refetchBlockedSlots } = useListBlockedSlots(id);
  const { data: blockedDays, refetch: refetchBlockedDays } = useListBlockedDays(id);

  // Trigger manual slots loading when manual booking date changes
  useEffect(() => {
    if (!addForm.appointmentDate || !id) {
      setManualSlots([]);
      return;
    }
    setLoadingManualSlots(true);
    fetch(`/api/clinics/${id}/slots?date=${addForm.appointmentDate}`)
      .then(res => res.json())
      .then(data => {
        setManualSlots(Array.isArray(data) ? data : []);
        setLoadingManualSlots(false);
      })
      .catch(() => {
        setManualSlots([]);
        setLoadingManualSlots(false);
      });
  }, [addForm.appointmentDate, id]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.patientName || !addForm.patientPhone || !addForm.appointmentDate || !addForm.selectedTimeSlot) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    createAppointmentMutation.mutate(
      {
        clinicId: id,
        data: {
          patientName: addForm.patientName,
          patientPhone: addForm.patientPhone,
          patientProblem: addForm.patientProblem || "General consultation",
          appointmentDate: addForm.appointmentDate,
          selectedTimeSlot: addForm.selectedTimeSlot,
          appointmentSource: addForm.appointmentSource as any,
          patientAge: addForm.patientAge ? Number(addForm.patientAge) : undefined,
          patientGender: addForm.patientGender,
          visitType: addForm.visitType,
          notes: addForm.notes || undefined,
        }
      },
      {
        onSuccess: () => {
          toast({ title: "Manual appointment created and synced with calendar" });
          setIsAddOpen(false);
          setAddForm({
            patientName: "",
            patientPhone: "",
            patientProblem: "",
            appointmentDate: "",
            selectedTimeSlot: "",
            appointmentSource: "Manual",
            patientAge: "",
            patientGender: "male",
            visitType: "New Consultation",
            notes: ""
          });
          queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey(id) });
        },
        onError: (err: any) => {
          toast({ title: "Failed to create appointment", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  const handleBlockSlotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockSlotForm.date || !blockSlotForm.startTime || !blockSlotForm.endTime) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    createBlockedSlotMutation.mutate(
      {
        clinicId: id,
        data: {
          date: blockSlotForm.date,
          startTime: blockSlotForm.startTime,
          endTime: blockSlotForm.endTime,
          reason: blockSlotForm.reason || undefined,
        }
      },
      {
        onSuccess: () => {
          toast({ title: "Time slot blocked successfully" });
          setIsBlockSlotOpen(false);
          setBlockSlotForm({ date: "", startTime: "", endTime: "", reason: "" });
          refetchBlockedSlots();
        },
        onError: (err: any) => {
          toast({ title: "Failed to block slot", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  const handleBlockDaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockDayForm.date) {
      toast({ title: "Please select a date", variant: "destructive" });
      return;
    }

    createBlockedDayMutation.mutate(
      {
        clinicId: id,
        data: {
          date: blockDayForm.date,
          reason: blockDayForm.reason || undefined,
        }
      },
      {
        onSuccess: () => {
          toast({ title: "Day blocked successfully" });
          setIsBlockDayOpen(false);
          setBlockDayForm({ date: "", reason: "" });
          refetchBlockedDays();
        },
        onError: (err: any) => {
          toast({ title: "Failed to block day", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  const handleUnblockSlot = (slotId: number) => {
    if (confirm("Are you sure you want to unblock this slot?")) {
      deleteBlockedSlotMutation.mutate(
        { clinicId: id, id: slotId },
        {
          onSuccess: () => {
            toast({ title: "Slot unblocked successfully" });
            refetchBlockedSlots();
          },
          onError: (err: any) => {
            toast({ title: "Failed to unblock slot", description: err.message, variant: "destructive" });
          }
        }
      );
    }
  };

  const handleUnblockDay = (dayId: number) => {
    if (confirm("Are you sure you want to unblock this day?")) {
      deleteBlockedDayMutation.mutate(
        { clinicId: id, id: dayId },
        {
          onSuccess: () => {
            toast({ title: "Day unblocked successfully" });
            refetchBlockedDays();
          },
          onError: (err: any) => {
            toast({ title: "Failed to unblock day", description: err.message, variant: "destructive" });
          }
        }
      );
    }
  };

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

    if (clinic.doctorSignatureUrl) {
      try {
        const sigImg = await loadImage(clinic.doctorSignatureUrl);
        let sigW = 40;
        let sigH = 10;
        if (sigImg.width && sigImg.height) {
          const ratio = sigImg.width / sigImg.height;
          if (ratio > 4) {
            sigW = 40;
            sigH = 40 / ratio;
          } else {
            sigH = 10;
            sigW = 10 * ratio;
          }
        }
        const sigX = 170 - (sigW / 2);
        const sigY = (footerY + 11) - sigH;
        doc.addImage(sigImg, "PNG", sigX, sigY, sigW, sigH);
      } catch (e) {
        console.error("Failed to load doctor signature image:", e);
      }
    }

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

  // Filter blocked slots for the selected date
  const blockedSlotsForSelectedDate = blockedSlots?.filter(bs =>
    isSameDay(selectedDate, bs.date)
  ) || [];

  // Filter blocked days for the selected date
  const blockedDaysForSelectedDate = blockedDays?.filter(bd =>
    isSameDay(selectedDate, bd.date)
  ) || [];

  const blockedDayForSelectedDate = blockedDays?.find(bd =>
    isSameDay(selectedDate, bd.date)
  );

  // Helper to extract slot minutes for sorting
  const getSlotMinutes = (slotStr: string | null | undefined) => {
    if (!slotStr) return 9999;
    try {
      const match = slotStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (!match) return 9999;
      let hour = parseInt(match[1], 10);
      const min = parseInt(match[2], 10);
      const modifier = match[3];
      if (hour === 12 && modifier && modifier.toUpperCase() === "AM") hour = 0;
      if (hour !== 12 && modifier && modifier.toUpperCase() === "PM") hour += 12;
      return hour * 60 + min;
    } catch {
      return 9999;
    }
  };

  // Build unified sorted list of appointments and blocked slots
  const unifiedList = [
    ...filteredAppointmentsForSelectedDate.map(apt => ({
      type: "appointment",
      id: apt.id,
      patientName: apt.patientName,
      patientPhone: apt.patientPhone,
      selectedTimeSlot: apt.selectedTimeSlot,
      patientProblem: apt.patientProblem,
      status: apt.status,
      appointmentSource: apt.appointmentSource || "Online",
      prescriptionGenerated: apt.prescriptionGenerated,
      raw: apt
    })),
    // Only include blocked slots if filter is 'all' or 'blocked'
    ...(filter === "all" || filter === "blocked" ? blockedSlotsForSelectedDate.map(bs => ({
      type: "blocked_slot",
      id: bs.id,
      patientName: `Blocked Slot: ${bs.reason || "No reason specified"}`,
      patientPhone: `Time: ${bs.startTime} - ${bs.endTime}`,
      selectedTimeSlot: bs.startTime,
      status: "blocked",
      appointmentSource: "Manual",
      prescriptionGenerated: false,
      raw: bs
    })) : [])
  ];

  const sortedUnifiedList = [...unifiedList].sort((a, b) => {
    return getSlotMinutes(a.selectedTimeSlot) - getSlotMinutes(b.selectedTimeSlot);
  });

  const formatTime24to12 = (timeStr: string): string => {
    if (!timeStr) return "";
    const [hoursStr, minutesStr] = timeStr.trim().split(":");
    const h = parseInt(hoursStr, 10);
    if (isNaN(h)) return timeStr;
    const m = minutesStr ? parseInt(minutesStr, 10) : 0;
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHours = h % 12 === 0 ? 12 : h % 12;
    const displayMinutes = m.toString().padStart(2, "0");
    const displayHoursStr = displayHours.toString().padStart(2, "0");
    return `${displayHoursStr}:${displayMinutes} ${ampm}`;
  };

  const formatTimeSlot = (slotStr: string | null | undefined): string => {
    if (!slotStr) return "No slot assigned";
    if (slotStr.toUpperCase().includes("AM") || slotStr.toUpperCase().includes("PM")) {
      return slotStr;
    }
    const parts = slotStr.trim().split(":");
    const h = parseInt(parts[0], 10);
    if (isNaN(h)) return slotStr;
    const m = parts[1] ? parseInt(parts[1], 10) : 0;
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHours = h % 12 === 0 ? 12 : h % 12;
    const displayMinutes = m.toString().padStart(2, "0");
    const displayHoursStr = displayHours.toString().padStart(2, "0");
    return `${displayHoursStr}:${displayMinutes} ${ampm}`;
  };

  const getDotColor = (item: any) => {
    if (item.type === "blocked_slot") return "bg-rose-500";
    if (item.status === "completed") return "bg-purple-500";
    if (item.status === "cancelled") return "bg-slate-700";
    if (item.appointmentSource === "Online") return "bg-blue-500";
    return "bg-orange-500";
  };

  const getItemStatusColor = (item: any) => {
    if (item.type === "blocked_slot") {
      return "bg-red-100 text-red-800 border-red-200";
    }
    if (item.status === "completed") {
      return "bg-purple-100 text-purple-800 border-purple-200";
    }
    if (item.status === "cancelled") {
      return "bg-slate-100 text-slate-800 border-slate-200";
    }
    if (item.appointmentSource === "Online") {
      return "bg-blue-100 text-blue-800 border-blue-200";
    }
    return "bg-orange-100 text-orange-800 border-orange-200";
  };

  const getItemStatusLabel = (item: any) => {
    if (item.type === "blocked_slot") {
      return "Blocked";
    }
    if (item.status === "completed") {
      return "Completed";
    }
    if (item.status === "cancelled") {
      return "Cancelled";
    }
    if (item.appointmentSource === "Online") {
      return "Online";
    }
    return item.appointmentSource || "Manual";
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Calendar Card */}
        <div className="lg:col-span-5">
          <Card className="bg-white border-slate-100 shadow-sm rounded-xl overflow-hidden h-full flex flex-col">
            <CardHeader className="border-b border-slate-50 bg-slate-50/50 py-5 px-6">
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2 font-display">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                Appointment Calendar
              </CardTitle>
              <p className="text-xs text-slate-400 mt-1">Select a date to view and manage appointments</p>
            </CardHeader>
            <CardContent className="p-5 flex-1 flex items-center justify-center">
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
                  hasAppointment: "bg-primary/10 text-primary font-bold border-b-2 border-b-primary rounded-md"
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Appointments List */}
        <div className="lg:col-span-7">
          <Card className="bg-white border-slate-100 shadow-sm rounded-xl overflow-hidden h-full flex flex-col">
            <CardHeader className="border-b border-slate-50 bg-slate-50/50 flex flex-col md:flex-row md:items-center md:justify-between py-4.5 px-6 gap-4">
              <div>
                <CardTitle className="text-base font-bold text-slate-800 font-display">
                  Selected Date: {format(selectedDate, "dd MMMM yyyy")}
                </CardTitle>
                <p className="text-xs text-slate-400 mt-1">
                  {appointmentsForSelectedDate.length} appointment(s) scheduled
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={() => {
                      setAddForm(f => ({ ...f, appointmentDate: format(selectedDate, "yyyy-MM-dd") }));
                      setIsAddOpen(true);
                    }}
                    className="gap-1 bg-primary text-white font-bold h-8.5 text-xs rounded-lg shadow-sm cursor-pointer hover:opacity-90"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Appointment
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setBlockSlotForm(f => ({ ...f, date: format(selectedDate, "yyyy-MM-dd") }));
                      setIsBlockSlotOpen(true);
                    }}
                    variant="outline"
                    className="gap-1 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 font-bold h-8.5 text-xs rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Block Slot
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setBlockDayForm(f => ({ ...f, date: format(selectedDate, "yyyy-MM-dd") }));
                      setIsBlockDayOpen(true);
                    }}
                    variant="outline"
                    className="gap-1 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 font-bold h-8.5 text-xs rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Block Day
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Filter:</span>
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-36 h-9 text-xs rounded-lg border-slate-200 bg-white">
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
                    <SelectItem value="blocked">Blocked Slots</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="p-6 flex-1 overflow-y-auto">
              {blockedDayForSelectedDate && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-between text-rose-800 mb-4 animate-in slide-in-from-top duration-300">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold block uppercase tracking-wider">Entire Day Blocked</span>
                      <span className="text-xs text-rose-600 mt-0.5 block">{blockedDayForSelectedDate.reason || "No reason specified"}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-bold border-rose-200 hover:bg-rose-100/50 hover:text-rose-900 text-rose-800 rounded-lg cursor-pointer"
                    onClick={() => handleUnblockDay(blockedDayForSelectedDate.id)}
                  >
                    Unblock Day
                  </Button>
                </div>
              )}
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
                </div>
              ) : sortedUnifiedList.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center h-full min-h-[300px]">
                  <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-4">
                    <CalendarX2 className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 font-display mb-1">No schedule found</h3>
                  <p className="text-xs text-slate-400 max-w-[250px] leading-relaxed">
                    {appointmentsForSelectedDate.length === 0 && blockedSlotsForSelectedDate.length === 0
                      ? "There are no appointments or blocked slots scheduled for this date."
                      : "No items match your status filter."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedUnifiedList.map((item) => {
                    const statusDotColor = getDotColor(item);
                    const statusBadgeColor = getItemStatusColor(item);
                    const statusBadgeLabel = getItemStatusLabel(item);

                    if (item.type === "blocked_slot") {
                      return (
                        <div
                          key={`blocked-${item.id}`}
                          className="p-4 border border-rose-100 bg-rose-50/10 hover:bg-rose-50/20 transition-all rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                        >
                          <div className="space-y-1.5">
                            <h4 className="font-semibold text-rose-950 flex items-center gap-2 font-display">
                              <span className={`w-2 h-2 rounded-full ${statusDotColor} shrink-0`} />
                              Blocked Slot
                            </h4>
                            <div className="flex flex-col gap-1 text-xs text-rose-700">
                              <span className="flex items-center gap-1.5 font-medium">
                                <Clock className="w-3.5 h-3.5 text-rose-400" />
                                {formatTime24to12(item.raw.startTime)} – {formatTime24to12(item.raw.endTime)}
                              </span>
                              {item.raw.reason && (
                                <span className="text-[11px] text-rose-600 font-medium italic mt-0.5">
                                  Reason: {item.raw.reason}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 justify-between sm:justify-end shrink-0">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${statusBadgeColor}`}>
                              {statusBadgeLabel}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs font-bold border-rose-205 hover:bg-rose-100/50 hover:text-rose-900 text-rose-800 rounded-lg cursor-pointer"
                              onClick={() => handleUnblockSlot(item.id)}
                            >
                              Unblock Slot
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    const apt = item.raw;
                    return (
                      <div
                        key={`appt-${apt.id}`}
                        className="p-4 border border-slate-100 hover:border-primary/20 hover:shadow-md cursor-pointer transition-all bg-white rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                        onClick={() => handleRowClick(apt)}
                        data-testid={`row-appointment-${apt.id}`}
                      >
                        <div className="space-y-1.5">
                          <h4 className="font-semibold text-slate-800 flex items-center gap-2 group-hover:text-primary transition-colors font-display">
                            <span className={`w-2 h-2 rounded-full ${statusDotColor} shrink-0`} />
                            {apt.patientName}
                          </h4>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-450" />
                              {formatTimeSlot(apt.selectedTimeSlot)}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-450" />
                              {apt.patientPhone}
                            </span>
                            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {apt.appointmentSource || "Online"}
                            </span>
                          </div>
                          {apt.patientProblem && (
                            <p className="text-xs text-slate-500 mt-1 italic line-clamp-1 max-w-sm">
                              "{apt.patientProblem}"
                            </p>
                          )}
                          
                          {/* Prescription Status Badge */}
                          <div className="flex flex-wrap gap-2 pt-1">
                            {apt.prescriptionGenerated ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                Prescription Generated
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                Prescription Missing
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 justify-between sm:justify-end shrink-0">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${statusBadgeColor}`}>
                            {statusBadgeLabel}
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
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Appointment Edit & Slot Assignment Dialog */}
      {selectedAppointment && (
        <Dialog open={!!selectedAppointment} onOpenChange={(open) => !open && setSelectedAppointment(null)}>
          <DialogContent className={`transition-all duration-300 ${activeTab !== "details" ? "max-w-3xl" : "max-w-md"} bg-white rounded-2xl p-6 shadow-xl border border-slate-100/80 max-h-[90vh] overflow-y-auto`}>
            <DialogHeader className="pb-3 border-b border-slate-100/60 flex flex-row items-center justify-between">
              <DialogTitle className="text-base font-bold text-slate-800 font-display">Appointment Details</DialogTitle>
            </DialogHeader>

            {/* Navigation Tabs (Sleek pill style) */}
            <div className="bg-slate-100/70 p-1 rounded-xl flex gap-1 mb-4">
              <button
                type="button"
                onClick={() => setActiveTab("details")}
                className={`flex-1 py-1.5 px-3 text-xs font-bold transition-all rounded-lg ${
                  activeTab === "details"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Appointment
              </button>

              {selectedAppointment.status !== "cancelled" && (
                <button
                  type="button"
                  onClick={() => setActiveTab("prescription")}
                  className={`flex-1 py-1.5 px-3 text-xs font-bold transition-all rounded-lg ${
                    activeTab === "prescription"
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Prescription
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`flex-1 py-1.5 px-3 text-xs font-bold transition-all rounded-lg ${
                  activeTab === "history"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                History
              </button>
            </div>

            {/* Tab 1: Details / Rescheduling */}
            {activeTab === "details" && (
              <form onSubmit={handleConfirmReschedule} className="space-y-5">
                <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-100 space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-450 font-medium">Patient</span>
                    <span className="font-bold text-slate-800">{selectedAppointment.patientName}</span>
                  </div>
                  {selectedAppointment.patientAge && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-450 font-medium">Age</span>
                      <span className="font-semibold text-slate-700">{selectedAppointment.patientAge} years</span>
                    </div>
                  )}
                  {selectedAppointment.patientGender && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-450 font-medium">Gender</span>
                      <span className="font-semibold text-slate-700 capitalize">{selectedAppointment.patientGender}</span>
                    </div>
                  )}
                  {selectedAppointment.visitType && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-450 font-medium">Visit Type</span>
                      <span className="font-semibold text-slate-700">{selectedAppointment.visitType}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-450 font-medium">Source</span>
                    <span className="font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider">{selectedAppointment.appointmentSource || "Online"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-450 font-medium">Phone</span>
                    <span className="font-semibold text-slate-700">{selectedAppointment.patientPhone}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-450 font-medium">Reason</span>
                    <span className="font-semibold text-slate-700 text-right truncate max-w-[200px]" title={selectedAppointment.patientProblem}>
                      {selectedAppointment.patientProblem || "General consultation"}
                    </span>
                  </div>
                  {selectedAppointment.notes && (
                    <div className="flex flex-col gap-1 pt-1.5 border-t border-slate-200/50">
                      <span className="text-slate-450 font-medium">Notes</span>
                      <span className="font-medium text-slate-600 italic block">{selectedAppointment.notes}</span>
                    </div>
                  )}
                  <div className={`flex justify-between items-center ${selectedAppointment.notes ? "pt-1.5" : "pt-2.5 border-t border-slate-200/50"}`}>
                    <span className="text-slate-450 font-medium">Prescription Status</span>
                    {prescription ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-50 text-green-700 border border-green-200 uppercase tracking-wider">
                        Generated
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
                        Pending
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rescheduleStatus" className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Appointment Status</Label>
                  <Select value={rescheduleStatus} onValueChange={(val) => setRescheduleStatus(val as AppointmentStatus)}>
                    <SelectTrigger id="rescheduleStatus" className="w-full text-xs h-10 border-slate-200 bg-white">
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
                    <Label htmlFor="rescheduleDate" className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Select Date</Label>
                    <Input
                      id="rescheduleDate"
                      type="date"
                      value={rescheduleDate}
                      onChange={(e) => {
                        setRescheduleDate(e.target.value);
                        setRescheduleSlot("");
                      }}
                      className="text-xs h-10 border-slate-200 bg-white focus-visible:bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="rescheduleSlot" className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Assign Time Slot</Label>
                    <Select
                      value={rescheduleSlot}
                      onValueChange={setRescheduleSlot}
                      disabled={loadingSlots || !rescheduleDate}
                    >
                      <SelectTrigger id="rescheduleSlot" className="w-full text-xs h-10 border-slate-200 bg-white">
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
                  className="w-full text-xs font-bold h-10.5 mt-2 rounded-xl shadow-md shadow-primary/5 active:scale-[0.99] cursor-pointer"
                  disabled={updateStatus.isPending || (rescheduleStatus === "confirmed" && !rescheduleSlot)}
                >
                  {updateStatus.isPending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
                  Confirm Updates
                </Button>
              </form>
            )}

            {activeTab === "details" && selectedAppointment && selectedAppointment.status !== "cancelled" && (
              <div className="pt-4 mt-4 border-t border-slate-100 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Prescription Quick Actions</span>
                {prescription ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab("prescription")}
                      className="text-xs h-9.5 border-primary/20 text-primary hover:bg-primary/5 gap-1.5 font-bold col-span-2 justify-center rounded-xl cursor-pointer"
                    >
                      <FileText className="w-4 h-4" /> View Prescription Details
                    </Button>
                    <Button
                      type="button"
                      onClick={() => generatePrescriptionPDF(clinic, selectedAppointment, prescription, "download")}
                      className="text-xs h-9.5 font-bold gap-1.5 justify-center rounded-xl cursor-pointer shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" /> Download PDF
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => generatePrescriptionPDF(clinic, selectedAppointment, prescription, "print")}
                      className="text-xs h-9.5 font-bold gap-1.5 justify-center rounded-xl border border-slate-200/80 cursor-pointer shadow-sm"
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
                          className="text-xs h-9.5 bg-[#25D366] hover:bg-[#20ba56] text-white shadow-sm hover:shadow-md transition-all rounded-xl flex items-center justify-center gap-1.5 font-bold col-span-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
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
                    className="w-full text-xs font-bold h-10 gap-1.5 justify-center rounded-xl cursor-pointer"
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
                  <form onSubmit={handleSavePrescription} className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="diag" className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Diagnosis</Label>
                        <Input
                          id="diag"
                          value={prescriptionForm.diagnosis}
                          onChange={(e) => setPrescriptionForm({ ...prescriptionForm, diagnosis: e.target.value })}
                          className="h-10 border-slate-200 text-xs bg-white focus-visible:bg-white"
                          placeholder="e.g. Acute Tonsillitis"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="complaint" className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Chief Complaint</Label>
                        <Input
                          id="complaint"
                          value={prescriptionForm.chiefComplaint}
                          onChange={(e) => setPrescriptionForm({ ...prescriptionForm, chiefComplaint: e.target.value })}
                          className="h-10 border-slate-200 text-xs bg-white focus-visible:bg-white"
                          placeholder="e.g. Sore throat, fever"
                        />
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-display">Rx - Medicines</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addMedicineRow}
                          className="h-7 text-[10px] border-dashed text-primary border-primary/20 hover:bg-primary/5 px-2.5 rounded-lg cursor-pointer font-bold"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Add Medicine
                        </Button>
                      </div>

                      <div className="space-y-3.5">
                        {prescriptionForm.medicines.map((med, index) => (
                          <div key={index} className="p-4 bg-slate-50/50 border border-slate-150 rounded-xl space-y-3.5">
                            <div className="grid grid-cols-12 gap-2">
                              <div className="col-span-12 md:col-span-4 space-y-1.5">
                                <Label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Medicine Name</Label>
                                <Input
                                  value={med.name}
                                  onChange={(e) => updateMedicineRow(index, "name", e.target.value)}
                                  placeholder="e.g. Paracetamol"
                                  className="h-8.5 text-xs border-slate-250 bg-white"
                                  required
                                />
                              </div>
                              <div className="col-span-4 md:col-span-2 space-y-1.5">
                                <Label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Dosage</Label>
                                <Input
                                  value={med.dosage}
                                  onChange={(e) => updateMedicineRow(index, "dosage", e.target.value)}
                                  placeholder="e.g. 500mg"
                                  className="h-8.5 text-xs border-slate-250 bg-white"
                                />
                              </div>
                              <div className="col-span-4 md:col-span-3 space-y-1.5">
                                <Label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Frequency</Label>
                                <Input
                                  value={med.frequency}
                                  onChange={(e) => updateMedicineRow(index, "frequency", e.target.value)}
                                  placeholder="e.g. 1-0-1"
                                  className="h-8.5 text-xs border-slate-250 bg-white"
                                />
                              </div>
                              <div className="col-span-4 md:col-span-3 space-y-1.5">
                                <Label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Duration</Label>
                                <Input
                                  value={med.duration}
                                  onChange={(e) => updateMedicineRow(index, "duration", e.target.value)}
                                  placeholder="e.g. 5 Days"
                                  className="h-8.5 text-xs border-slate-250 bg-white"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-12 gap-2.5 items-center">
                              <div className="col-span-8 md:col-span-7 space-y-1.5">
                                <Label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Instructions</Label>
                                <Input
                                  value={med.instructions}
                                  onChange={(e) => updateMedicineRow(index, "instructions", e.target.value)}
                                  placeholder="e.g. After Food"
                                  className="h-8.5 text-xs border-slate-250 bg-white"
                                />
                              </div>
                              <div className="col-span-4 md:col-span-5 flex items-end justify-end gap-1.5 pt-4 shrink-0">
                                <Select
                                  value=""
                                  onValueChange={(val) => {
                                    const t = templates.find((item) => item.name === val);
                                    if (t) selectTemplateForMedicine(index, t);
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-[9px] font-bold border-slate-250 px-2 max-w-[110px] bg-white rounded-lg">
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
                                    className="text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 h-8 w-8 rounded-lg shrink-0 cursor-pointer"
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
                      <Label htmlFor="advice" className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Additional Advice</Label>
                      <textarea
                        id="advice"
                        value={prescriptionForm.additionalAdvice}
                        onChange={(e) => setPrescriptionForm({ ...prescriptionForm, additionalAdvice: e.target.value })}
                        className="flex min-h-[60px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
                        placeholder="e.g. Avoid cold drinks and take bed rest."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="followUp" className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Follow-Up Date</Label>
                        <Input
                          id="followUp"
                          type="date"
                          value={prescriptionForm.followUpDate}
                          onChange={(e) => setPrescriptionForm({ ...prescriptionForm, followUpDate: e.target.value })}
                          className="h-10 border-slate-200 text-xs bg-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="docNotes" className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Doctor Notes (Internal Only)</Label>
                        <textarea
                          id="docNotes"
                          value={prescriptionForm.doctorNotes}
                          onChange={(e) => setPrescriptionForm({ ...prescriptionForm, doctorNotes: e.target.value })}
                          className="flex min-h-[60px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
                          placeholder="e.g. Signs of mild allergy observed"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2.5">
                      <Button type="submit" className="flex-1 h-10 text-xs font-bold rounded-xl shadow-sm cursor-pointer">
                        Save Prescription
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsEditingPrescription(false)}
                        className="flex-1 h-10 text-xs font-semibold border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : prescription ? (
                  <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                    <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4.5 space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-xs border-b border-slate-200/40 pb-3.5">
                        <div>
                          <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Diagnosis</span>
                          <span className="font-extrabold text-slate-800 mt-1 block font-display text-sm">{prescription.diagnosis || "General evaluation"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Chief Complaint</span>
                          <span className="font-bold text-slate-700 mt-1 block text-xs">{prescription.chiefComplaint || "Routine checkup"}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Medicines (Rx)</span>
                        <div className="space-y-2">
                          {(() => {
                            let medsList = [];
                            try {
                              medsList = typeof prescription.medicines === "string" ? JSON.parse(prescription.medicines) : prescription.medicines;
                            } catch {
                              medsList = [];
                            }
                            return medsList.map((med: any, idx: number) => (
                              <div key={idx} className="bg-white rounded-xl p-3 border border-slate-150 text-xs space-y-1.5 shadow-sm">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-slate-800 text-xs">{med.name}</span>
                                  <span className="text-primary font-bold text-[10px] bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">{med.dosage}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-slate-450 font-semibold text-[10px] pt-1.5 border-t border-slate-50">
                                  <div>Freq: {med.frequency}</div>
                                  <div>Dur: {med.duration}</div>
                                  <div>Inst: {med.instructions || "None"}</div>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs border-t border-slate-200/40 pt-3.5">
                        <div>
                          <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Additional Advice</span>
                          <span className="font-medium text-slate-700 mt-1 block whitespace-pre-wrap leading-relaxed">{prescription.additionalAdvice || "No additional guidelines"}</span>
                        </div>
                        {prescription.followUpDate && (
                          <div>
                            <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Follow-Up Date</span>
                            <span className="font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 text-[10px] inline-block mt-1 uppercase tracking-wider">
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
                        <div className="text-xs border-t border-slate-200/40 pt-3.5">
                          <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Doctor Notes (Internal)</span>
                          <span className="font-normal text-slate-500 mt-1 block italic leading-relaxed">{prescription.doctorNotes}</span>
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

                            <div className="grid grid-cols-2 gap-2.5">
                              <Button
                                onClick={() => generatePrescriptionPDF(clinic, selectedAppointment, prescription, "download")}
                                className="text-xs h-10 rounded-xl flex items-center justify-center gap-1.5 font-bold cursor-pointer shadow-sm"
                              >
                                <Download className="w-3.5 h-3.5" /> Download PDF
                              </Button>
                              <Button
                                onClick={() => generatePrescriptionPDF(clinic, selectedAppointment, prescription, "print")}
                                className="text-xs h-10 rounded-xl flex items-center justify-center gap-1.5 font-bold cursor-pointer border border-slate-200"
                                variant="secondary"
                              >
                                <Printer className="w-3.5 h-3.5" /> Print
                              </Button>
                              <Button
                                onClick={handleSendPrescriptionWhatsApp}
                                disabled={!!phoneError}
                                className="text-xs h-10 bg-[#25D366] hover:bg-[#20ba56] text-white shadow-sm hover:shadow-md transition-all rounded-xl flex items-center justify-center gap-1.5 font-bold col-span-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                              >
                                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg> Send via WhatsApp
                              </Button>
                              <Button
                                onClick={handleStartAddPrescription}
                                className="text-xs h-10 rounded-xl flex items-center justify-center gap-1.5 font-bold cursor-pointer"
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
                  <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl">
                    <span className="text-xs text-slate-500 mb-4 font-semibold">No prescription created yet for this appointment.</span>
                    <Button onClick={handleStartAddPrescription} className="text-xs h-9 font-bold rounded-xl px-4 gap-1.5 cursor-pointer">
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
                  <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl">
                    <span className="text-xs text-slate-450 font-semibold">No previous prescriptions found for this patient.</span>
                  </div>
                ) : (
                  <div className="space-y-3.5 max-h-[55vh] overflow-y-auto pr-1">
                    {patientHistory.map((histPresc) => (
                      <div key={histPresc.id} className="p-4 bg-white border border-slate-150 rounded-xl shadow-sm space-y-3 transition-all hover:border-slate-300">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                            {format(new Date(histPresc.createdAt), "dd MMMM yyyy")}
                          </span>
                          <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-150">
                            {histPresc.followUpDate ? `Follow-Up: ${formatDateDisplay(histPresc.followUpDate)}` : "No Follow-Up"}
                          </span>
                        </div>

                        <div className="text-xs space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 font-semibold">Diagnosis:</span>{" "}
                            <span className="font-bold text-slate-800">{histPresc.diagnosis || "N/A"}</span>
                          </div>
                          <div className="mt-2">
                            <span className="text-slate-400 font-semibold block mb-1">Medicines (Rx):</span>
                            <div className="flex flex-wrap gap-1.5">
                              {(() => {
                                let medsList = [];
                                try {
                                  medsList = typeof histPresc.medicines === "string" ? JSON.parse(histPresc.medicines) : histPresc.medicines;
                                } catch {
                                  medsList = [];
                                }
                                return medsList.map((m: any, i: number) => (
                                  <span key={i} className="text-[9px] font-bold text-slate-600 bg-slate-50 border border-slate-200/50 px-2 py-0.5 rounded-md">
                                    {m.name} ({m.dosage})
                                  </span>
                                ));
                              })()}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1.5 justify-end border-t border-slate-100 mt-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setPrescription(histPresc);
                              setActiveTab("prescription");
                            }}
                            className="h-8 text-xs font-bold rounded-lg px-3 gap-1 border border-slate-200 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" /> View Details
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => generatePrescriptionPDF(clinic, selectedAppointment, histPresc, "download")}
                            className="h-8 text-xs font-bold rounded-lg px-3 gap-1 cursor-pointer"
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

      {/* Success Rescheduling Modal */}
      {successModalData && (
        <Dialog open={!!successModalData} onOpenChange={(open) => !open && setSuccessModalData(null)}>
          <DialogContent className="max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <DialogHeader className="pb-4 border-b border-slate-100">
              <DialogTitle className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2 font-display">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                Reschedule Success
              </DialogTitle>
            </DialogHeader>

            <div className="py-4 space-y-5">
              {/* Success Indicators */}
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 text-xs text-emerald-800 font-bold bg-emerald-50/70 px-3.5 py-2.5 rounded-xl border border-emerald-100/50">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                  <span>Clinic Calendar Synced</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-emerald-800 font-bold bg-emerald-50/70 px-3.5 py-2.5 rounded-xl border border-emerald-100/50">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                  <span>Google Calendar Synced</span>
                </div>
              </div>

              {/* Appointment details */}
              <div className="bg-slate-50/80 rounded-xl p-5 border border-slate-100 space-y-4">
                <div className="grid grid-cols-3 gap-2 py-0.5 border-b border-slate-200/50 pb-3 text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Patient</span>
                  <span className="col-span-2 font-bold text-slate-800">{successModalData.patientName}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-0.5 border-b border-slate-200/50 pb-3 text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Doctor</span>
                  <span className="col-span-2 font-semibold text-slate-700">Dr. {successModalData.doctorName}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-0.5 text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider mt-0.5">New Slot</span>
                  <div className="col-span-2 space-y-1">
                    <div className="font-bold text-primary flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      {formatDateDisplay(successModalData.newDate)}
                    </div>
                    <div className="font-bold text-primary flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
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
                          className="flex-1 text-xs font-bold h-11 bg-[#25D366] hover:bg-[#20ba56] text-white shadow-md hover:shadow-lg transition-all rounded-xl gap-2 active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                        >
                          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          WhatsApp Patient
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setSuccessModalData(null)}
                          className="flex-1 text-xs font-semibold h-11 border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl cursor-pointer"
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

      {/* Add Appointment Dialog */}
      {isAddOpen && (
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-100/80 max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-3 border-b border-slate-100/60">
              <DialogTitle className="text-base font-bold text-slate-800 font-display">Add Appointment</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleAddSubmit} className="space-y-4 pt-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="addName" className="font-semibold text-slate-500 uppercase tracking-wider block">Patient Name *</Label>
                <Input
                  id="addName"
                  value={addForm.patientName}
                  onChange={(e) => setAddForm({ ...addForm, patientName: e.target.value })}
                  placeholder="Patient Full Name"
                  className="h-10 border-slate-200 text-xs bg-white focus-visible:bg-white"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="addPhone" className="font-semibold text-slate-500 uppercase tracking-wider block">Mobile Number *</Label>
                <Input
                  id="addPhone"
                  value={addForm.patientPhone}
                  onChange={(e) => setAddForm({ ...addForm, patientPhone: e.target.value })}
                  placeholder="e.g. +919876543210"
                  className="h-10 border-slate-200 text-xs bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="addAge" className="font-semibold text-slate-500 uppercase tracking-wider block">Age</Label>
                  <Input
                    id="addAge"
                    type="number"
                    value={addForm.patientAge}
                    onChange={(e) => setAddForm({ ...addForm, patientAge: e.target.value })}
                    placeholder="Years"
                    className="h-10 border-slate-200 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="addGender" className="font-semibold text-slate-500 uppercase tracking-wider block">Gender</Label>
                  <Select value={addForm.patientGender} onValueChange={(val) => setAddForm({ ...addForm, patientGender: val })}>
                    <SelectTrigger id="addGender" className="w-full text-xs h-10 border-slate-200 bg-white">
                      <SelectValue placeholder="Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="addVisitType" className="font-semibold text-slate-500 uppercase tracking-wider block">Visit Type</Label>
                  <Select value={addForm.visitType} onValueChange={(val) => setAddForm({ ...addForm, visitType: val })}>
                    <SelectTrigger id="addVisitType" className="w-full text-xs h-10 border-slate-200 bg-white">
                      <SelectValue placeholder="Visit Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New Consultation">New Consultation</SelectItem>
                      <SelectItem value="Follow-up">Follow-up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="addSource" className="font-semibold text-slate-500 uppercase tracking-wider block">Source</Label>
                  <Select value={addForm.appointmentSource} onValueChange={(val) => setAddForm({ ...addForm, appointmentSource: val })}>
                    <SelectTrigger id="addSource" className="w-full text-xs h-10 border-slate-200 bg-white">
                      <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Manual">Manual</SelectItem>
                      <SelectItem value="Phone">Phone</SelectItem>
                      <SelectItem value="Walk-in">Walk-in</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="addProblem" className="font-semibold text-slate-500 uppercase tracking-wider block">Reason / Problem</Label>
                <Input
                  id="addProblem"
                  value={addForm.patientProblem}
                  onChange={(e) => setAddForm({ ...addForm, patientProblem: e.target.value })}
                  placeholder="e.g. Fever, Cough"
                  className="h-10 border-slate-200 text-xs bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="addDate" className="font-semibold text-slate-500 uppercase tracking-wider block">Appointment Date *</Label>
                  <Input
                    id="addDate"
                    type="date"
                    value={addForm.appointmentDate}
                    onChange={(e) => setAddForm({ ...addForm, appointmentDate: e.target.value, selectedTimeSlot: "" })}
                    className="h-10 border-slate-200 text-xs bg-white"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="addSlot" className="font-semibold text-slate-500 uppercase tracking-wider block">Select Time Slot *</Label>
                  <Select
                    value={addForm.selectedTimeSlot}
                    onValueChange={(val) => setAddForm({ ...addForm, selectedTimeSlot: val })}
                    disabled={loadingManualSlots || !addForm.appointmentDate}
                  >
                    <SelectTrigger id="addSlot" className="w-full text-xs h-10 border-slate-200 bg-white">
                      <SelectValue placeholder={loadingManualSlots ? "Loading..." : "Select Slot"} />
                    </SelectTrigger>
                    <SelectContent>
                      {manualSlots.length === 0 ? (
                        <SelectItem value="_" disabled>
                          {addForm.appointmentDate ? "No free slots available" : "Select date first"}
                        </SelectItem>
                      ) : (
                        manualSlots.map((slot) => (
                          <SelectItem key={slot} value={slot}>
                            {slot}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="addNotes" className="font-semibold text-slate-500 uppercase tracking-wider block">Notes (Optional)</Label>
                <textarea
                  id="addNotes"
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  className="flex min-h-[60px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  placeholder="Additional patient notes..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                  className="flex-1 h-11 text-xs font-semibold rounded-xl border-slate-200 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createAppointmentMutation.isPending}
                  className="flex-1 h-11 text-xs font-bold rounded-xl shadow-md cursor-pointer"
                >
                  {createAppointmentMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
                  Create Appointment
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Block Slot Dialog */}
      {isBlockSlotOpen && (
        <Dialog open={isBlockSlotOpen} onOpenChange={setIsBlockSlotOpen}>
          <DialogContent className="max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-100/80">
            <DialogHeader className="pb-3 border-b border-slate-100/60">
              <DialogTitle className="text-base font-bold text-slate-800 font-display">Block Appointment Slot</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleBlockSlotSubmit} className="space-y-4 pt-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="blockSlotDate" className="font-semibold text-slate-500 uppercase tracking-wider block">Date *</Label>
                <Input
                  id="blockSlotDate"
                  type="date"
                  value={blockSlotForm.date}
                  onChange={(e) => setBlockSlotForm({ ...blockSlotForm, date: e.target.value })}
                  className="h-10 border-slate-200 text-xs bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="blockSlotStart" className="font-semibold text-slate-500 uppercase tracking-wider block">Start Time (24h format) *</Label>
                  <Input
                    id="blockSlotStart"
                    type="text"
                    value={blockSlotForm.startTime}
                    onChange={(e) => setBlockSlotForm({ ...blockSlotForm, startTime: e.target.value })}
                    placeholder="e.g. 13:00"
                    className="h-10 border-slate-200 text-xs bg-white"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="blockSlotEnd" className="font-semibold text-slate-500 uppercase tracking-wider block">End Time (24h format) *</Label>
                  <Input
                    id="blockSlotEnd"
                    type="text"
                    value={blockSlotForm.endTime}
                    onChange={(e) => setBlockSlotForm({ ...blockSlotForm, endTime: e.target.value })}
                    placeholder="e.g. 14:00"
                    className="h-10 border-slate-200 text-xs bg-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="blockSlotReason" className="font-semibold text-slate-500 uppercase tracking-wider block">Reason (Optional)</Label>
                <Input
                  id="blockSlotReason"
                  value={blockSlotForm.reason}
                  onChange={(e) => setBlockSlotForm({ ...blockSlotForm, reason: e.target.value })}
                  placeholder="e.g. Lunch Break, Personal Time"
                  className="h-10 border-slate-200 text-xs bg-white"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsBlockSlotOpen(false)}
                  className="flex-1 h-11 text-xs font-semibold rounded-xl border-slate-200 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createBlockedSlotMutation.isPending}
                  className="flex-1 h-11 text-xs font-bold rounded-xl shadow-md bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                >
                  {createBlockedSlotMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
                  Block Slot
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Block Day Dialog */}
      {isBlockDayOpen && (
        <Dialog open={isBlockDayOpen} onOpenChange={setIsBlockDayOpen}>
          <DialogContent className="max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-100/80">
            <DialogHeader className="pb-3 border-b border-slate-100/60">
              <DialogTitle className="text-base font-bold text-slate-800 font-display">Block Entire Day</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleBlockDaySubmit} className="space-y-4 pt-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="blockDayDate" className="font-semibold text-slate-500 uppercase tracking-wider block">Select Date *</Label>
                <Input
                  id="blockDayDate"
                  type="date"
                  value={blockDayForm.date}
                  onChange={(e) => setBlockDayForm({ ...blockDayForm, date: e.target.value })}
                  className="h-10 border-slate-200 text-xs bg-white"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="blockDayReason" className="font-semibold text-slate-500 uppercase tracking-wider block">Reason (Optional)</Label>
                <Input
                  id="blockDayReason"
                  value={blockDayForm.reason}
                  onChange={(e) => setBlockDayForm({ ...blockDayForm, reason: e.target.value })}
                  placeholder="e.g. Public Holiday, Medical Leave"
                  className="h-10 border-slate-200 text-xs bg-white"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsBlockDayOpen(false)}
                  className="flex-1 h-11 text-xs font-semibold rounded-xl border-slate-200 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createBlockedDayMutation.isPending}
                  className="flex-1 h-11 text-xs font-bold rounded-xl shadow-md bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                >
                  {createBlockedDayMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
                  Block Entire Day
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
