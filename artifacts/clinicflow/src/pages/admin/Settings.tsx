import { useState, useEffect } from "react";
import { useParams, useSearch } from "wouter";
import { useGetClinic, useUpdateClinic, getGetClinicQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Save, Calendar, CheckCircle2, LogOut, Plus, Trash2, Link, Copy, ExternalLink, QrCode, Download } from "lucide-react";

const DAYS_OF_WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAYS_LABELS: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

interface Session {
  start: string;
  end: string;
}

export default function Settings() {
  const { clinicId } = useParams();
  const search = useSearch();
  const id = Number(clinicId);
  const { data: clinic, isLoading } = useGetClinic(id);
  const updateClinic = useUpdateClinic();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    clinicName: "",
    contactEmail: "",
    address: "",
    consultationFee: "",
    operatingTimings: "",
    workingDays: "",
    slotDuration: 30,
    clinicLogo: "",
    doctorName: "",
    doctorQualification: "",
    doctorSpecialization: "",
    clinicPhoneNumber: "",
  });

  const [sessions, setSessions] = useState<Session[]>([
    { start: "09:00", end: "17:00" }
  ]);

  const [qrOpen, setQrOpen] = useState(false);

  const getClinicSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const clinicNameForSlug = clinic?.name || formData.clinicName || "";
  const clinicSlug = getClinicSlug(clinicNameForSlug);
  const publicUrl = clinicSlug ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/book/${clinicSlug}` : "";
  const qrUrl = publicUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(publicUrl)}` : "";

  const handleCopyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    toast({ title: "Link copied to clipboard!" });
  };

  const downloadQRCode = async () => {
    try {
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${clinicSlug}-qr-code.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "QR code downloaded successfully!" });
    } catch (error) {
      console.error("Failed to download QR code:", error);
      toast({ title: "Failed to download QR code", variant: "destructive" });
    }
  };

  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(search);
    if (query.get("connected") === "true") {
      toast({ title: "Google Calendar connected successfully!" });
    } else if (query.get("error")) {
      toast({
        title: "Failed to connect Google Calendar",
        description: query.get("error") || undefined,
        variant: "destructive"
      });
    }
  }, [search]);

  useEffect(() => {
    if (clinic) {
      let parsedSessions: Session[] = (clinic as any).workingSessions || [];
      if (parsedSessions.length === 0) {
        parsedSessions = [
          { start: "09:00", end: "17:00" }
        ];
      }
      setSessions(parsedSessions);

      setFormData({
        clinicName: (clinic as any).clinicName || "",
        contactEmail: (clinic as any).contactEmail || "",
        address: clinic.address || "",
        consultationFee: (clinic as any).consultationFee || "",
        operatingTimings: (clinic as any).operatingTimings || "",
        workingDays: clinic.workingDays || "monday,tuesday,wednesday,thursday,friday",
        slotDuration: clinic.slotDuration || 30,
        clinicLogo: (clinic as any).clinicLogo || "",
        doctorName: (clinic as any).doctorName || "",
        doctorQualification: (clinic as any).doctorQualification || "",
        doctorSpecialization: (clinic as any).doctorSpecialization || "",
        clinicPhoneNumber: (clinic as any).clinicPhoneNumber || "",
      });
    }
  }, [clinic]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      toast({
        title: "Validation Error",
        description: "Logo image must be smaller than 1MB.",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, clinicLogo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setFormData(prev => ({ ...prev, clinicLogo: "" }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.clinicName?.trim()) {
      toast({
        title: "Validation Error",
        description: "Clinic Name is required.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.doctorName?.trim()) {
      toast({
        title: "Validation Error",
        description: "Doctor Name is required.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.clinicPhoneNumber?.trim()) {
      toast({
        title: "Validation Error",
        description: "Clinic Phone Number is required.",
        variant: "destructive"
      });
      return;
    }

    if (sessions.length === 0) {
      toast({
        title: "Validation Error",
        description: "You must configure at least one working session.",
        variant: "destructive"
      });
      return;
    }

    const timeToMinutes = (timeStr: string) => {
      const parts = timeStr.trim().split(":");
      if (parts.length !== 2) return null;
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
      return h * 60 + m;
    };

    // 1. Validate formats and start < end
    for (let i = 0; i < sessions.length; i++) {
      const startMins = timeToMinutes(sessions[i].start);
      const endMins = timeToMinutes(sessions[i].end);
      if (startMins === null || endMins === null) {
        toast({
          title: "Validation Error",
          description: `Session ${i + 1} has an invalid time format. Use HH:MM format (e.g., 09:00).`,
          variant: "destructive"
        });
        return;
      }
      if (startMins >= endMins) {
        toast({
          title: "Validation Error",
          description: `Session ${i + 1} Start Time must be earlier than End Time.`,
          variant: "destructive"
        });
        return;
      }
    }

    // 2. Validate overlaps
    const sorted = [...sessions].map((s, idx) => ({
      startMins: timeToMinutes(s.start)!,
      endMins: timeToMinutes(s.end)!,
      originalIdx: idx
    })).sort((a, b) => a.startMins - b.startMins);

    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].endMins > sorted[i + 1].startMins) {
        toast({
          title: "Validation Error",
          description: `Sessions must not overlap. Session ${sorted[i].originalIdx + 1} and Session ${sorted[i + 1].originalIdx + 1} overlap.`,
          variant: "destructive"
        });
        return;
      }
    }

    const updatedFormData = {
      ...formData,
      workingSessions: sessions,
    };

    updateClinic.mutate({ clinicId: id, data: updatedFormData }, {
      onSuccess: () => {
        toast({ title: "Settings updated successfully" });
        queryClient.invalidateQueries({ queryKey: getGetClinicQueryKey(id) });
      },
      onError: () => {
        toast({ title: "Failed to update settings", variant: "destructive" });
      }
    });
  };

  const handleConnectGoogle = () => {
    window.location.href = `/api/clinics/${id}/auth/google`;
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm("Are you sure you want to disconnect Google Calendar? This will stop syncing appointments.")) {
      return;
    }
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/clinics/${id}/auth/google/disconnect`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast({ title: "Google Calendar disconnected" });
      queryClient.invalidateQueries({ queryKey: getGetClinicQueryKey(id) });
    } catch {
      toast({ title: "Failed to disconnect Google Calendar", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-6">
        <Skeleton className="h-[200px] w-full rounded-xl" />
        <Skeleton className="h-[250px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8 animate-in fade-in duration-500 pb-12">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Card 1: Profile settings */}
        <Card className="bg-white border-gray-100 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-gray-50 bg-gray-50/50">
            <CardTitle className="text-lg font-semibold text-gray-900">Clinic Profile</CardTitle>
            <CardDescription>Update your clinic's public information.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {/* Clinic Logo */}
            <div className="grid gap-2">
              <Label className="text-sm font-semibold text-gray-700">Clinic Logo</Label>
              <div className="flex items-center gap-4 p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                <div className="relative w-20 h-20 bg-gray-100 border border-gray-200 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                  {formData.clinicLogo ? (
                    <img src={formData.clinicLogo} alt="Clinic Logo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-gray-400 text-xs font-semibold text-center px-1">No Logo</div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="logo-upload"
                      className="h-9 px-4 text-xs font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center cursor-pointer transition-all duration-200"
                    >
                      Upload Image
                    </Label>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
                    {formData.clinicLogo && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleRemoveLogo}
                        className="h-9 px-4 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all duration-200"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 font-medium">PNG, JPG or GIF. Max size 1MB.</p>
                </div>
              </div>
            </div>

            {/* Clinic Name */}
            <div className="grid gap-2">
              <Label htmlFor="clinicName">Clinic Name *</Label>
              <Input
                id="clinicName"
                value={formData.clinicName}
                onChange={e => setFormData({ ...formData, clinicName: e.target.value })}
                className="bg-gray-50/50 focus-visible:bg-white"
              />
            </div>

            {/* Doctor Name */}
            <div className="grid gap-2">
              <Label htmlFor="doctorName">Doctor Name *</Label>
              <Input
                id="doctorName"
                value={formData.doctorName}
                onChange={e => setFormData({ ...formData, doctorName: e.target.value })}
                className="bg-gray-50/50 focus-visible:bg-white"
                placeholder="e.g. Dr. Raj Sharma"
              />
            </div>

            {/* Doctor Qualification */}
            <div className="grid gap-2">
              <Label htmlFor="doctorQualification">Doctor Qualification</Label>
              <Input
                id="doctorQualification"
                value={formData.doctorQualification}
                onChange={e => setFormData({ ...formData, doctorQualification: e.target.value })}
                className="bg-gray-50/50 focus-visible:bg-white"
                placeholder="e.g. MBBS, MD"
              />
            </div>

            {/* Doctor Specialization */}
            <div className="grid gap-2">
              <Label htmlFor="doctorSpecialization">Doctor Specialization</Label>
              <Input
                id="doctorSpecialization"
                value={formData.doctorSpecialization}
                onChange={e => setFormData({ ...formData, doctorSpecialization: e.target.value })}
                className="bg-gray-50/50 focus-visible:bg-white"
                placeholder="e.g. General Physician"
              />
            </div>

            {/* Clinic Phone Number */}
            <div className="grid gap-2">
              <Label htmlFor="clinicPhoneNumber">Clinic Phone Number *</Label>
              <Input
                id="clinicPhoneNumber"
                value={formData.clinicPhoneNumber}
                onChange={e => setFormData({ ...formData, clinicPhoneNumber: e.target.value })}
                className="bg-gray-50/50 focus-visible:bg-white"
                placeholder="e.g. 9812345678"
              />
            </div>

            {/* Contact Email */}
            <div className="grid gap-2">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={e => setFormData({ ...formData, contactEmail: e.target.value })}
                className="bg-gray-50/50 focus-visible:bg-white"
              />
            </div>

            {/* Address */}
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="bg-gray-50/50 focus-visible:bg-white"
              />
            </div>

            {/* Consultation Fee */}
            <div className="grid gap-2">
              <Label htmlFor="consultationFee">Consultation Fee</Label>
              <Input
                id="consultationFee"
                value={formData.consultationFee}
                onChange={e => setFormData({ ...formData, consultationFee: e.target.value })}
                className="bg-gray-50/50 focus-visible:bg-white"
              />
            </div>

            {/* Operating Timings */}
            <div className="grid gap-2">
              <Label htmlFor="operatingTimings">Operating Timings Text (Display Only)</Label>
              <Input
                id="operatingTimings"
                value={formData.operatingTimings}
                onChange={e => setFormData({ ...formData, operatingTimings: e.target.value })}
                className="bg-gray-50/50 focus-visible:bg-white"
              />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Scheduler & Timing Settings */}
        <Card className="bg-white border-gray-100 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-gray-50 bg-gray-50/50">
            <CardTitle className="text-lg font-semibold text-gray-900">Scheduler & Timing Settings</CardTitle>
            <CardDescription>Configure working hours and booking slots for automated scheduling.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid gap-3">
              <Label className="text-sm font-semibold text-gray-700">Working Days</Label>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const selectedDays = formData.workingDays
                    ? formData.workingDays.split(",").map(d => d.trim().toLowerCase()).filter(Boolean)
                    : [];
                  return DAYS_OF_WEEK.map((day) => {
                    const isSelected = selectedDays.includes(day);
                    return (
                      <Button
                        key={day}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        className={`h-11 px-4 text-sm font-semibold rounded-xl transition-all duration-200 ${
                          isSelected
                            ? "bg-primary text-primary-foreground shadow-sm hover:opacity-90 scale-[1.02]"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                        onClick={() => {
                          let updatedDays;
                          if (isSelected) {
                            updatedDays = selectedDays.filter(d => d !== day);
                          } else {
                            updatedDays = [...selectedDays, day].sort(
                              (a, b) => DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b)
                            );
                          }
                          setFormData({
                            ...formData,
                            workingDays: updatedDays.join(","),
                          });
                        }}
                      >
                        {DAYS_LABELS[day]}
                      </Button>
                    );
                  });
                })()}
              </div>
              <p className="text-xs text-gray-500 font-medium">Select the working days when the clinic is open and accepting bookings.</p>
            </div>
            <div className="space-y-4">
              <Label className="text-sm font-semibold text-gray-700">Working Sessions</Label>
              <div className="space-y-3">
                {sessions.map((session, index) => (
                  <div key={index} className="flex items-end gap-4 p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div className="grid gap-1.5">
                        <Label htmlFor={`session-start-${index}`} className="text-xs text-gray-500 font-semibold">
                          Start Time (24h format)
                        </Label>
                        <Input
                          id={`session-start-${index}`}
                          type="text"
                          placeholder="09:00"
                          value={session.start}
                          onChange={(e) => {
                            const newSessions = [...sessions];
                            newSessions[index].start = e.target.value;
                            setSessions(newSessions);
                          }}
                          className="bg-white border-gray-200 text-xs h-10"
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor={`session-end-${index}`} className="text-xs text-gray-500 font-semibold">
                          End Time (24h format)
                        </Label>
                        <Input
                          id={`session-end-${index}`}
                          type="text"
                          placeholder="17:00"
                          value={session.end}
                          onChange={(e) => {
                            const newSessions = [...sessions];
                            newSessions[index].end = e.target.value;
                            setSessions(newSessions);
                          }}
                          className="bg-white border-gray-200 text-xs h-10"
                        />
                      </div>
                    </div>
                    {sessions.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const newSessions = sessions.filter((_, i) => i !== index);
                          setSessions(newSessions);
                        }}
                        className="text-gray-400 hover:text-red-600 hover:bg-red-50 h-10 w-10 rounded-lg shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSessions([...sessions, { start: "09:00", end: "17:00" }]);
                }}
                className="text-xs font-semibold h-10 px-4 rounded-xl border-dashed border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
                Add Session
              </Button>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slotDuration">Slot Duration (Minutes)</Label>
              <Input
                id="slotDuration"
                type="number"
                value={formData.slotDuration}
                onChange={e => setFormData({ ...formData, slotDuration: parseInt(e.target.value) || 30 })}
                placeholder="30"
                className="bg-gray-50/50 focus-visible:bg-white"
              />
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <Button type="submit" disabled={updateClinic.isPending} className="w-full sm:w-auto">
                {updateClinic.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Public Booking Link Card */}
      <Card className="bg-white border-gray-100 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-gray-50 bg-gray-50/50">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Link className="w-5 h-5 text-primary" />
            Public Booking Link
          </CardTitle>
          <CardDescription>
            Share this link on Google Business Profile, WhatsApp, Instagram Bio, Facebook, or your website to let patients book appointments directly.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="publicBookingUrl" className="text-sm font-semibold text-gray-700">Public URL</Label>
            <div className="flex gap-2">
              <Input
                id="publicBookingUrl"
                readOnly
                value={publicUrl}
                className="bg-gray-50 text-gray-600 cursor-text focus-visible:ring-0 flex-1 h-10 border-gray-200"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyLink}
                className="h-10 px-4 font-semibold gap-1.5 border-gray-200 hover:bg-gray-50"
                title="Copy Link"
              >
                <Copy className="w-4 h-4" /> Copy Link
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              type="button"
              onClick={() => window.open(publicUrl, "_blank")}
              className="h-10 text-xs font-semibold rounded-xl flex-1 sm:flex-initial gap-1.5"
            >
              <ExternalLink className="w-4 h-4" /> Open Link
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setQrOpen(true)}
              className="h-10 text-xs font-semibold rounded-xl flex-1 sm:flex-initial gap-1.5 border-gray-200 hover:bg-gray-50"
            >
              <QrCode className="w-4 h-4" /> Generate QR Code
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      {qrOpen && (
        <Dialog open={qrOpen} onOpenChange={setQrOpen}>
          <DialogContent className="max-w-xs bg-white rounded-2xl p-6 shadow-2xl border border-gray-100 flex flex-col items-center">
            <DialogHeader className="w-full border-b border-gray-50 pb-3">
              <DialogTitle className="text-center text-lg font-bold text-gray-900">Clinic QR Code</DialogTitle>
            </DialogHeader>

            <div className="py-6 flex flex-col items-center gap-4">
              <div className="p-3 bg-white border border-gray-150 rounded-2xl shadow-inner">
                {qrUrl ? (
                  <img
                    src={qrUrl}
                    alt="Clinic Booking QR Code"
                    className="w-48 h-48 object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-gray-400">
                    Generating...
                  </div>
                )}
              </div>
              <p className="text-[11px] text-gray-400 font-semibold uppercase text-center tracking-wider max-w-[200px]">
                Scan to book an appointment
              </p>
            </div>

            <div className="w-full flex gap-2 pt-2">
              <Button
                type="button"
                onClick={downloadQRCode}
                className="flex-1 text-xs font-semibold h-10 gap-1.5 rounded-xl"
              >
                <Download className="w-4 h-4" /> Download QR
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setQrOpen(false)}
                className="flex-1 text-xs font-semibold h-10 border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Card 3: Google Calendar Connection */}
      <Card className="bg-white border-gray-100 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-gray-50 bg-gray-50/50">
          <CardTitle className="text-lg font-semibold text-gray-900">Google Calendar Sync</CardTitle>
          <CardDescription>Automatically block slots from your Google Calendar and write confirmed bookings.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {clinic?.googleConnected ? (
            <div className="space-y-6">
              <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-100 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-green-950">Synchronized Successfully</h4>
                  <p className="text-sm text-green-800 mt-1">
                    Your scheduling assistant is connected to Google account: <span className="font-medium">{clinic.googleConnectedEmail}</span>.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleDisconnectGoogle}
                  disabled={disconnecting}
                  variant="destructive"
                  className="w-full sm:w-auto text-xs font-semibold h-10"
                >
                  {disconnecting ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <LogOut className="w-3.5 h-3.5 mr-2" />}
                  Disconnect Google Calendar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <Calendar className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-950">Calendar Sync Disabled</h4>
                  <p className="text-sm text-amber-800 mt-1">
                    Connect your clinic Google Calendar account. The receptionist chatbot will query your calendar's busy events in real-time, preventing double bookings.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleConnectGoogle}
                  className="w-full sm:w-auto text-xs font-semibold h-10"
                >
                  <Calendar className="w-3.5 h-3.5 mr-2" />
                  Connect Google Calendar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
