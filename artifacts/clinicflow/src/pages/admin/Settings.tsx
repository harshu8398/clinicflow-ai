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
import { Loader2, Save, Calendar, CheckCircle2, LogOut, Plus, Trash2, Link, Copy, ExternalLink, QrCode, Download, Image as ImageIcon, MapPin, Mail, Phone, IndianRupee, Clock, ShieldCheck, HelpCircle } from "lucide-react";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";

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
        <Skeleton className="h-[200px] w-full rounded-xl animate-pulse" />
        <Skeleton className="h-[250px] w-full rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8 animate-in fade-in duration-500 pb-12">
      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Card 1: Profile settings */}
        <Card className="bg-white border-slate-100 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-slate-50 bg-slate-50/50 py-5 px-6">
            <CardTitle className="text-base font-bold text-slate-800 font-display">Clinic Profile</CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-1">Configure your clinic's public profile and metadata details.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            
            {/* Clinic Logo Upload Box */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-550 uppercase tracking-wider">Clinic Branding Logo</Label>
              <div className="flex items-center gap-4 p-4.5 bg-slate-50/50 rounded-xl border border-slate-100/80 transition-all hover:bg-slate-50">
                <div className="relative w-20 h-20 bg-white border border-slate-200/80 rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                  {formData.clinicLogo ? (
                    <ImageWithFallback src={formData.clinicLogo} alt="Clinic Logo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-slate-400 text-[10px] font-bold text-center px-1 uppercase tracking-wider flex flex-col items-center gap-1">
                      <ImageIcon className="w-5 h-5 opacity-70" />
                      No Logo
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="logo-upload"
                      className="h-8.5 px-3.5 text-xs font-bold rounded-xl border border-slate-250 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center cursor-pointer transition-all shadow-sm active:scale-97"
                    >
                      Choose file
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
                        className="h-8.5 px-3.5 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50/50 rounded-xl transition-all"
                      >
                        Remove Logo
                      </Button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Supported file types: PNG, JPG, or WEBP. Max size 1MB.</p>
                </div>
              </div>
            </div>

            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              
              {/* Clinic Name */}
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="clinicName" className="text-xs font-semibold text-slate-550 uppercase tracking-wider">Clinic Name *</Label>
                <Input
                  id="clinicName"
                  value={formData.clinicName}
                  onChange={e => setFormData({ ...formData, clinicName: e.target.value })}
                  className="bg-white border-slate-200 focus:border-primary focus:ring-primary/20 rounded-lg text-xs h-10"
                  required
                />
              </div>

              {/* Doctor Name */}
              <div className="space-y-1.5">
                <Label htmlFor="doctorName" className="text-xs font-semibold text-slate-550 uppercase tracking-wider">Doctor Name *</Label>
                <Input
                  id="doctorName"
                  value={formData.doctorName}
                  onChange={e => setFormData({ ...formData, doctorName: e.target.value })}
                  className="bg-white border-slate-200 focus:border-primary focus:ring-primary/20 rounded-lg text-xs h-10"
                  placeholder="e.g. Dr. Raj Sharma"
                  required
                />
              </div>

              {/* Doctor Qualification */}
              <div className="space-y-1.5">
                <Label htmlFor="doctorQualification" className="text-xs font-semibold text-slate-550 uppercase tracking-wider">Doctor Qualification</Label>
                <Input
                  id="doctorQualification"
                  value={formData.doctorQualification}
                  onChange={e => setFormData({ ...formData, doctorQualification: e.target.value })}
                  className="bg-white border-slate-200 focus:border-primary focus:ring-primary/20 rounded-lg text-xs h-10"
                  placeholder="e.g. MBBS, MD"
                />
              </div>

              {/* Doctor Specialization */}
              <div className="space-y-1.5">
                <Label htmlFor="doctorSpecialization" className="text-xs font-semibold text-slate-550 uppercase tracking-wider">Doctor Specialization</Label>
                <Input
                  id="doctorSpecialization"
                  value={formData.doctorSpecialization}
                  onChange={e => setFormData({ ...formData, doctorSpecialization: e.target.value })}
                  className="bg-white border-slate-200 focus:border-primary focus:ring-primary/20 rounded-lg text-xs h-10"
                  placeholder="e.g. General Physician"
                />
              </div>

              {/* Clinic Phone Number */}
              <div className="space-y-1.5">
                <Label htmlFor="clinicPhoneNumber" className="text-xs font-semibold text-slate-550 uppercase tracking-wider">Clinic Phone Number *</Label>
                <div className="relative">
                  <Input
                    id="clinicPhoneNumber"
                    value={formData.clinicPhoneNumber}
                    onChange={e => setFormData({ ...formData, clinicPhoneNumber: e.target.value })}
                    className="bg-white border-slate-200 focus:border-primary focus:ring-primary/20 rounded-lg text-xs h-10 pl-8.5"
                    placeholder="e.g. 9812345678"
                    required
                  />
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
                </div>
              </div>

              {/* Contact Email */}
              <div className="space-y-1.5">
                <Label htmlFor="contactEmail" className="text-xs font-semibold text-slate-550 uppercase tracking-wider">Contact Email</Label>
                <div className="relative">
                  <Input
                    id="contactEmail"
                    type="email"
                    value={formData.contactEmail}
                    onChange={e => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="bg-white border-slate-200 focus:border-primary focus:ring-primary/20 rounded-lg text-xs h-10 pl-8.5"
                    placeholder="e.g. clinic@domain.com"
                  />
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
                </div>
              </div>

              {/* Consultation Fee */}
              <div className="space-y-1.5">
                <Label htmlFor="consultationFee" className="text-xs font-semibold text-slate-550 uppercase tracking-wider">Consultation Fee (₹)</Label>
                <div className="relative">
                  <Input
                    id="consultationFee"
                    value={formData.consultationFee}
                    onChange={e => setFormData({ ...formData, consultationFee: e.target.value })}
                    className="bg-white border-slate-200 focus:border-primary focus:ring-primary/20 rounded-lg text-xs h-10 pl-8.5"
                    placeholder="e.g. 500"
                  />
                  <IndianRupee className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="address" className="text-xs font-semibold text-slate-550 uppercase tracking-wider">Address</Label>
                <div className="relative">
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className="bg-white border-slate-200 focus:border-primary focus:ring-primary/20 rounded-lg text-xs h-10 pl-8.5"
                    placeholder="e.g. Sector-15, Rohini, New Delhi"
                  />
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
                </div>
              </div>

              {/* Operating Timings */}
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="operatingTimings" className="text-xs font-semibold text-slate-550 uppercase tracking-wider">Operating Timings Text (Display Only)</Label>
                <div className="relative">
                  <Input
                    id="operatingTimings"
                    value={formData.operatingTimings}
                    onChange={e => setFormData({ ...formData, operatingTimings: e.target.value })}
                    className="bg-white border-slate-200 focus:border-primary focus:ring-primary/20 rounded-lg text-xs h-10 pl-8.5"
                    placeholder="e.g. Mon-Sat: 9 AM - 6 PM"
                  />
                  <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
                </div>
              </div>
            </div>

          </CardContent>
        </Card>
 
        {/* Card 2: Scheduler & Timing Settings */}
        <Card className="bg-white border-slate-100 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-slate-50 bg-slate-50/50 py-5 px-6">
            <CardTitle className="text-base font-bold text-slate-800 font-display">Scheduler & Timing Settings</CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-1">Configure working hours and booking slots for automated scheduling.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            {/* Working Days */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-slate-550 uppercase tracking-wider">Working Days</Label>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const selectedDays = formData.workingDays
                    ? formData.workingDays.split(",").map(d => d.trim().toLowerCase()).filter(Boolean)
                    : [];
                  return DAYS_OF_WEEK.map((day) => {
                    const isSelected = selectedDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        className={`h-9 px-4.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                          isSelected
                            ? "bg-primary text-white shadow-sm shadow-primary/10"
                            : "bg-slate-50 text-slate-600 border border-slate-200/60 hover:bg-slate-100"
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
                      </button>
                    );
                  });
                })()}
              </div>
              <p className="text-[10px] text-slate-400">Select the working days when the clinic is open and accepting bookings.</p>
            </div>

            {/* Working Sessions */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <Label className="text-xs font-semibold text-slate-550 uppercase tracking-wider">Working Sessions</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSessions([...sessions, { start: "09:00", end: "17:00" }]);
                  }}
                  className="text-xs font-bold h-7.5 border-dashed border-primary/20 text-primary hover:bg-primary/5 px-2.5 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Session
                </Button>
              </div>
              
              <div className="space-y-3.5">
                {sessions.map((session, index) => (
                  <div key={index} className="flex items-end gap-3.5 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor={`session-start-${index}`} className="text-[10px] font-bold text-slate-450 uppercase">
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
                          className="bg-white border-slate-200 text-xs h-9 rounded-lg focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`session-end-${index}`} className="text-[10px] font-bold text-slate-450 uppercase">
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
                          className="bg-white border-slate-200 text-xs h-9 rounded-lg focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
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
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 h-9 w-9 rounded-lg shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Slot Duration */}
            <div className="space-y-1.5 pt-2">
              <Label htmlFor="slotDuration" className="text-xs font-semibold text-slate-550 uppercase tracking-wider">Slot Duration (Minutes)</Label>
              <Input
                id="slotDuration"
                type="number"
                value={formData.slotDuration}
                onChange={e => setFormData({ ...formData, slotDuration: parseInt(e.target.value) || 30 })}
                placeholder="30"
                className="bg-white border-slate-200 focus:border-primary focus:ring-primary/20 rounded-lg text-xs h-10"
              />
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <Button 
                type="submit" 
                disabled={updateClinic.isPending} 
                className="w-full sm:w-auto h-10 px-5 text-xs font-bold rounded-xl shadow-md shadow-primary/5 active:scale-97 cursor-pointer"
              >
                {updateClinic.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving Changes…
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Configuration
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Public Booking Link Card */}
      <Card className="bg-white border-slate-100 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="border-b border-slate-50 bg-slate-50/50 py-5 px-6">
          <CardTitle className="text-base font-bold text-slate-800 font-display flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
              <Link className="w-4 h-4" />
            </div>
            Public Booking Interface
          </CardTitle>
          <CardDescription className="text-xs text-slate-400 mt-1">
            Publish this portal link on your Google profile, Whatsapp status, or social media bio to collect patient bookings seamlessly.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="publicBookingUrl" className="text-xs font-semibold text-slate-550 uppercase tracking-wider">Patient Booking URL</Label>
            <div className="flex gap-2">
              <Input
                id="publicBookingUrl"
                readOnly
                value={publicUrl}
                className="bg-slate-55 border-slate-200 text-slate-500 font-mono text-[11px] h-10 rounded-lg select-all"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyLink}
                className="h-10 px-4 text-xs font-bold border-slate-250 hover:bg-slate-50 rounded-lg gap-1.5 cursor-pointer shadow-sm active:scale-97"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Link
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <Button
              type="button"
              onClick={() => window.open(publicUrl, "_blank")}
              className="h-9.5 text-xs font-bold rounded-xl flex-1 sm:flex-initial gap-1.5 shadow-sm cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open Booking Page
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setQrOpen(true)}
              className="h-9.5 text-xs font-bold rounded-xl flex-1 sm:flex-initial gap-1.5 border-slate-250 bg-white hover:bg-slate-50 cursor-pointer shadow-sm"
            >
              <QrCode className="w-3.5 h-3.5" /> Get Portal QR Code
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      {qrOpen && (
        <Dialog open={qrOpen} onOpenChange={setQrOpen}>
          <DialogContent className="max-w-xs bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 flex flex-col items-center">
            <DialogHeader className="w-full border-b border-slate-150 pb-3">
              <DialogTitle className="text-center text-base font-bold text-slate-800 font-display">Clinic Booking QR Code</DialogTitle>
            </DialogHeader>

            <div className="py-5 flex flex-col items-center gap-4">
              <div className="p-3 bg-white border border-slate-150 rounded-2xl shadow-inner">
                {qrUrl ? (
                  <img
                    src={qrUrl}
                    alt="Clinic Booking QR Code"
                    className="w-48 h-48 object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-400 animate-pulse">
                    Generating QR...
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-450 font-bold uppercase text-center tracking-wider max-w-[200px]">
                Scan to book an appointment instantly
              </p>
            </div>

            <div className="w-full flex gap-2 pt-1">
              <Button
                type="button"
                onClick={downloadQRCode}
                className="flex-1 text-xs font-bold h-9.5 gap-1.5 rounded-xl cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Download QR
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setQrOpen(false)}
                className="flex-1 text-xs font-semibold h-9.5 border-slate-250 hover:bg-slate-50 text-slate-650 rounded-xl cursor-pointer"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Card 3: Google Calendar Connection */}
      <Card className="bg-white border-slate-100 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="border-b border-slate-50 bg-slate-50/50 py-5 px-6">
          <CardTitle className="text-base font-bold text-slate-800 font-display flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            Google Calendar Integration
          </CardTitle>
          <CardDescription className="text-xs text-slate-400 mt-1">Automatically block slots from your personal Google Calendar and sync confirmed sessions.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {clinic?.googleConnected ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3.5 p-4.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-900">
                <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                  <ShieldCheck className="w-4.5 h-4.5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-800">Synchronized Successfully</h4>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    Your digital receptionist assistant is authorized and connected to your Google account: <span className="font-bold text-emerald-950">{clinic.googleConnectedEmail}</span>.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleDisconnectGoogle}
                  disabled={disconnecting}
                  variant="destructive"
                  className="w-full sm:w-auto text-xs font-semibold h-10 px-4 rounded-xl cursor-pointer"
                >
                  {disconnecting ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <LogOut className="w-3.5 h-3.5 mr-2" />}
                  Disconnect Calendar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start gap-3.5 p-4.5 bg-amber-50 border border-amber-100 rounded-xl text-amber-900">
                <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-600 shrink-0">
                  <HelpCircle className="w-4.5 h-4.5 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-amber-800">Calendar Sync Inactive</h4>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Connecting your Google Calendar enables real-time slot checking. The ClinicFlow receptionist chatbot blocks busy events from your calendar, preventing scheduling conflicts.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleConnectGoogle}
                  className="w-full sm:w-auto text-xs font-bold h-10 px-5 rounded-xl shadow-sm cursor-pointer"
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
