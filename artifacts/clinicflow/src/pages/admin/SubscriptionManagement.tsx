import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShieldCheck, Plus, Sparkles, Clock, Trash2, ShieldAlert, Loader2, PlayCircle, Eye, Search, AlertCircle, RefreshCw } from "lucide-react";

export default function SubscriptionManagement() {
  const [clinics, setClinics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  // Dialog State
  const [activeClinic, setActiveClinic] = useState<any>(null);
  const [dialogType, setDialogType] = useState<"activate" | "extend" | "change" | null>(null);

  // Form Fields
  const [planType, setPlanType] = useState("Monthly");
  const [startDate, setStartDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [extendDays, setExtendDays] = useState(30);
  const [customDays, setCustomDays] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchClinics = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/subscriptions/clinics`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setClinics(data);
      }
    } catch (err) {
      console.error("Failed to load clinics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClinics();
  }, []);

  const handleAction = async (endpoint: string, body?: any, successMessage?: string, clinicIdOverride?: number) => {
    setSubmittingAction(true);
    const targetClinicId = clinicIdOverride ?? activeClinic?.id;
    if (!targetClinicId) {
      toast({
        title: "Action Failed",
        description: "Unable to locate clinic record.",
        variant: "destructive",
      });
      setSubmittingAction(false);
      return;
    }

    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/subscriptions/clinics/${targetClinicId}/${endpoint}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: body ? JSON.stringify(body) : undefined,
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to execute action");
      }

      toast({ title: successMessage || "Action completed successfully" });
      setDialogType(null);
      setActiveClinic(null);
      fetchClinics();
    } catch (err: any) {
      toast({
        title: "Action Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleActivate = () => {
    if (!startDate || !expiryDate) {
      toast({ title: "Validation Error", description: "Dates are required", variant: "destructive" });
      return;
    }
    handleAction("activate", { planType, startDate, expiryDate }, "Subscription activated manually");
  };

  const handleExtend = () => {
    const days = extendDays === 0 ? Number(customDays) : extendDays;
    if (isNaN(days) || days <= 0) {
      toast({ title: "Validation Error", description: "Please enter valid number of days", variant: "destructive" });
      return;
    }
    handleAction("extend", { days }, `Extended subscription by ${days} days`);
  };

  const handleChangePlan = () => {
    handleAction("change-plan", { planType }, `Changed plan successfully to ${planType}`);
  };

  const handleImpersonate = async (clinicId: number, name: string) => {
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/subscriptions/clinics/${clinicId}/impersonate`,
        { method: "POST", credentials: "include" }
      );
      if (res.ok) {
        toast({ title: "Troubleshooting Session", description: `Entering dashboard for: ${name}` });
        window.location.replace(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/admin/${clinicId}`);
      } else {
        const err = await res.json();
        throw new Error(err.error || "Failed to impersonate");
      }
    } catch (err: any) {
      toast({ title: "Impersonation Failed", description: err.message, variant: "destructive" });
    }
  };

  const filteredClinics = clinics.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.doctorName && c.doctorName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 font-display tracking-tight">Subscription Management</h2>
          <p className="text-xs text-slate-400 mt-1">Review, activate, extend, and troubleshoot platform clinics.</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by clinic name, owner email, or doctor name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10.5 h-10 border-slate-200 focus:border-primary focus:ring-primary/20 rounded-lg text-xs"
          />
        </div>
        <Button variant="outline" onClick={fetchClinics} className="h-10 border-slate-200 hover:bg-slate-50 font-semibold text-xs px-4 cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5 mr-2" /> Refresh List
        </Button>
      </div>

      {loading ? (
        <div className="min-h-[300px] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredClinics.length === 0 ? (
        <Card className="p-16 text-center border-dashed border-slate-200 rounded-xl">
          <h3 className="text-sm font-bold text-slate-800 font-display mb-1">No clinics found</h3>
          <p className="text-xs text-slate-400 leading-relaxed">Check back later or register a new clinic to begin.</p>
        </Card>
      ) : (
        <div className="grid gap-4.5">
          {filteredClinics.map((clinic) => {
            const statusColors: any = {
              Trial: "bg-blue-50 text-blue-700 border-blue-100",
              Active: "bg-green-50 text-green-700 border-green-100",
              Expired: "bg-red-50 text-red-700 border-red-100",
              Suspended: "bg-slate-50 text-slate-700 border-slate-100",
              Lifetime: "bg-purple-50 text-purple-700 border-purple-100",
              "Pending Verification": "bg-amber-50 text-amber-700 border-amber-100",
              Rejected: "bg-rose-50 text-rose-700 border-rose-100",
            };

            return (
              <Card
                key={clinic.id}
                className="bg-white border-slate-100 shadow-sm hover:shadow-md transition-all rounded-xl overflow-hidden"
              >
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-bold text-slate-800 text-lg leading-tight font-display">{clinic.name}</h4>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                            statusColors[clinic.subscriptionStatus] || "bg-slate-50 border-slate-100 text-slate-550"
                          }`}
                        >
                          {clinic.subscriptionStatus}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs">
                        <div>
                          <span className="font-bold text-slate-400 block uppercase tracking-wider text-[9px]">Doctor</span>
                          <span className="text-slate-700 font-bold block mt-1">{clinic.doctorName || "N/A"}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-400 block uppercase tracking-wider text-[9px]">Plan</span>
                          <span className="text-slate-700 font-bold block mt-1 uppercase">{clinic.planType}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-400 block uppercase tracking-wider text-[9px]">Expiry Date</span>
                          <span className="text-slate-700 font-bold block mt-1">
                            {clinic.expiryDate
                              ? new Date(clinic.expiryDate).toLocaleDateString()
                              : "Never (Lifetime)"}
                          </span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-400 block uppercase tracking-wider text-[9px]">Days Remaining</span>
                          <span className="text-primary font-extrabold block mt-1">
                            {clinic.subscriptionStatus === "Lifetime"
                              ? "Lifetime"
                              : `${clinic.daysRemaining} Days`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Grid */}
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-[11px] font-bold rounded-lg border-slate-200 hover:bg-slate-50 cursor-pointer"
                        onClick={() => {
                          setActiveClinic(clinic);
                          setPlanType(clinic.planType);
                          setDialogType("activate");
                        }}
                      >
                        Activate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-[11px] font-bold rounded-lg border-slate-200 hover:bg-slate-50 cursor-pointer"
                        onClick={() => {
                          setActiveClinic(clinic);
                          setDialogType("extend");
                        }}
                      >
                        Extend
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-[11px] font-bold rounded-lg border-slate-200 hover:bg-slate-50 cursor-pointer"
                        onClick={() => {
                          setActiveClinic(clinic);
                          setPlanType(clinic.planType);
                          setDialogType("change");
                        }}
                      >
                        Change Plan
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-[11px] font-bold rounded-lg border-slate-200 hover:bg-slate-50 cursor-pointer"
                        onClick={() => {
                          setActiveClinic(clinic);
                          handleAction("make-lifetime", null, "Access changed to Lifetime", clinic.id);
                        }}
                      >
                        Make Lifetime
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-[11px] font-bold rounded-lg border-slate-200 text-rose-600 hover:text-rose-700 hover:bg-rose-50/50 cursor-pointer"
                        onClick={() => {
                          if (confirm(`Are you sure you want to suspend ${clinic.name}?`)) {
                            setActiveClinic(clinic);
                            handleAction("suspend", null, "Clinic suspended successfully", clinic.id);
                          }
                        }}
                      >
                        Suspend
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleImpersonate(clinic.id, clinic.name)}
                        className="h-8 text-[11px] font-bold bg-primary hover:bg-primary/90 text-white rounded-lg cursor-pointer"
                      >
                        Login As Clinic
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setActiveClinic(clinic);
                          handleAction("expire-now", null, "Clinic status set to Expired", clinic.id);
                        }}
                        className="h-8 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer"
                        title="Force immediate expiry (Testing Action)"
                      >
                        Expire Now
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog: Activate Subscription */}
      <Dialog open={dialogType === "activate"} onOpenChange={(open) => !open && setDialogType(null)}>
        <DialogContent className="bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 font-display">Activate Subscription</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Plan Type</Label>
              <select
                value={planType}
                onChange={(e) => setPlanType(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary"
              >
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Yearly">Yearly</option>
                <option value="Free">Free</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 text-xs border-slate-200" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Expiry Date</Label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="h-10 text-xs border-slate-200" />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDialogType(null)} disabled={submittingAction} className="h-9.5 text-xs rounded-xl border-slate-200 cursor-pointer">
              Cancel
            </Button>
            <Button onClick={handleActivate} disabled={submittingAction} className="h-9.5 text-xs font-bold rounded-xl cursor-pointer">
              {submittingAction && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Extend Subscription */}
      <Dialog open={dialogType === "extend"} onOpenChange={(open) => !open && setDialogType(null)}>
        <DialogContent className="bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 font-display">Extend Subscription</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Extension Period</Label>
              <select
                value={extendDays}
                onChange={(e) => setExtendDays(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary"
              >
                <option value={7}>+7 Days</option>
                <option value={15}>+15 Days</option>
                <option value={30}>+30 Days</option>
                <option value={90}>+90 Days</option>
                <option value={0}>Custom Duration</option>
              </select>
            </div>
            {extendDays === 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Custom Days</Label>
                <Input
                  type="number"
                  placeholder="Enter number of days"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  className="h-10 text-xs border-slate-200"
                />
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDialogType(null)} disabled={submittingAction} className="h-9.5 text-xs rounded-xl border-slate-200 cursor-pointer">
              Cancel
            </Button>
            <Button onClick={handleExtend} disabled={submittingAction} className="h-9.5 text-xs font-bold rounded-xl cursor-pointer">
              {submittingAction && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Extend Expiry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Change Plan */}
      <Dialog open={dialogType === "change"} onOpenChange={(open) => !open && setDialogType(null)}>
        <DialogContent className="bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 font-display">Change Plan Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Select Plan</Label>
              <select
                value={planType}
                onChange={(e) => setPlanType(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary"
              >
                <option value="Demo">Demo</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Yearly">Yearly</option>
                <option value="Free">Free</option>
                <option value="Lifetime">Lifetime</option>
              </select>
            </div>
            <p className="text-[10px] text-amber-600 flex items-start gap-1 leading-relaxed bg-amber-50/70 border border-amber-100 p-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              Changing the plan will automatically update the clinic status and recalculate the expiration date based on standard plan durations.
            </p>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDialogType(null)} disabled={submittingAction} className="h-9.5 text-xs rounded-xl border-slate-200 cursor-pointer">
              Cancel
            </Button>
            <Button onClick={handleChangePlan} disabled={submittingAction} className="h-9.5 text-xs font-bold rounded-xl cursor-pointer">
              {submittingAction && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Update Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
