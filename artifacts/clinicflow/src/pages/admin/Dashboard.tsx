import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import { useGetDashboard, useUpdateAppointmentStatus, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Users, CalendarCheck, Clock, CheckCircle2, Calendar, AlertTriangle, Sparkles, CheckCircle, RefreshCw, UploadCloud, AlertCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";

export default function Dashboard() {
  const { clinicId } = useParams();
  const id = Number(clinicId);
  const { data: stats, isLoading } = useGetDashboard(id);
  const updateStatus = useUpdateAppointmentStatus();
  const queryClient = useQueryClient();

  const [subData, setSubData] = useState<any>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeStep, setUpgradeStep] = useState<"plans" | "upload" | "success">("plans");
  const [selectedPlan, setSelectedPlan] = useState("Monthly");
  const [screenshotBase64, setScreenshotBase64] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const fetchSubStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/subscriptions/my-status`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setSubData(data);
      }
    } catch (err) {
      console.error("Failed to load subscription status:", err);
    } finally {
      setLoadingSub(false);
    }
  }, []);

  useEffect(() => {
    fetchSubStatus();
  }, [fetchSubStatus]);

  const handleStatusChange = (appointmentId: number, status: string) => {
    updateStatus.mutate(
      { clinicId: id, appointmentId, data: { status: status as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey(id) });
        }
      }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSubmitError("");
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      setSubmitError("Supported types are PNG, JPG, JPEG, and WEBP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setSubmitError("File must not exceed 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshotBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!screenshotBase64) {
      setSubmitError("Please upload a payment proof screenshot.");
      return;
    }

    setSubmitError("");
    setIsSubmitting(true);
    try {
      const price =
        selectedPlan === "Monthly"
          ? subData?.settings?.monthlyPrice
          : selectedPlan === "Quarterly"
          ? subData?.settings?.quarterlyPrice
          : subData?.settings?.yearlyPrice;

      const res = await fetch(
        `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/subscriptions/requests`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ planType: selectedPlan, amount: price, screenshot: screenshotBase64, notes }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit request");
      }

      setUpgradeStep("success");
      fetchSubStatus();
    } catch (err: any) {
      setSubmitError(err.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPlanPrice = (plan: string) => {
    if (!subData?.settings) return "0";
    if (plan === "Monthly") return subData.settings.monthlyPrice;
    if (plan === "Quarterly") return subData.settings.quarterlyPrice;
    if (plan === "Yearly") return subData.settings.yearlyPrice;
    return "0";
  };

  if (isLoading || loadingSub) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!stats) return null;

  const subStatus = subData?.clinic?.subscriptionStatus ?? "Active";
  const planType = subData?.clinic?.planType ?? "Demo";
  const expiryDate = subData?.clinic?.expiryDate;

  let daysRemaining = 0;
  if (subStatus === "Lifetime") {
    daysRemaining = 999999;
  } else if (expiryDate) {
    const diffTime = new Date(expiryDate).getTime() - new Date().getTime();
    daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  const showExpiryWarning = subStatus !== "Lifetime" && daysRemaining <= 7 && daysRemaining > 0;

  const STATUS_LABELS: Record<string, string> = {
    pending: "Pending",
    pending_slot_selection: "Awaiting Slot",
    confirmed: "Confirmed",
    booked: "Booked",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  const statusColors: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-100",
    pending_slot_selection: "bg-orange-50 text-orange-700 border-orange-100",
    confirmed: "bg-blue-50 text-blue-700 border-blue-100",
    booked: "bg-sky-50 text-sky-700 border-sky-100",
    completed: "bg-green-50 text-green-700 border-green-100",
    cancelled: "bg-red-50 text-red-700 border-red-100",
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      {/* Expiry Alert Warning Banner */}
      {showExpiryWarning && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-xs font-semibold shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 animate-bounce" />
          <span>Your subscription expires in {daysRemaining} days. Please renew to avoid system restrictions.</span>
        </div>
      )}

      {/* Subscription Card Banner */}
      <Card className="bg-gradient-to-r from-primary/5 via-white to-primary/5 border border-primary/10 overflow-hidden shadow-xs rounded-xl">
        <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1 flex-1">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 font-display">
              <Sparkles className="w-4.5 h-4.5 text-primary" />
              Subscription Status: {subStatus === "Lifetime" ? "Lifetime Plan" : `${planType} Plan`}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[11px] text-slate-600 pt-3 font-medium">
              <div>
                <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[9px] mb-0.5">Current Plan:</span>
                <span className="text-slate-800 text-xs font-bold uppercase">{planType}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[9px] mb-0.5">Status:</span>
                <span className="text-slate-800 text-xs font-bold">{subStatus}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[9px] mb-0.5">Expiry Date:</span>
                <span className="text-slate-800 text-xs font-bold">
                  {subStatus === "Lifetime" ? "Never" : expiryDate ? new Date(expiryDate).toLocaleDateString() : "N/A"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[9px] mb-0.5">Days Remaining:</span>
                <span className="text-primary text-xs font-extrabold">
                  {subStatus === "Lifetime" ? "Lifetime" : `${daysRemaining} Days`}
                </span>
              </div>
            </div>
          </div>
          {planType === "Demo" && (
            <Button
              onClick={() => {
                setUpgradeStep("plans");
                setScreenshotBase64("");
                setNotes("");
                setShowUpgradeModal(true);
              }}
              className="px-5 py-2.5 bg-primary hover:bg-primary/95 text-white shadow-sm transition-all font-semibold rounded-lg shrink-0 text-xs"
            >
              Upgrade Plan
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-white border-slate-100 hover:border-slate-200 transition-all duration-300 rounded-xl overflow-hidden shadow-xs hover:shadow-md relative pl-1.5 select-none">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8.5 h-8.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-500 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-400 mb-0.5">Total</p>
            <h3 className="text-2xl font-extrabold text-slate-800 font-display">{stats.totalAppointments}</h3>
          </CardContent>
        </Card>
        
        <Card className="bg-white border-slate-100 hover:border-slate-200 transition-all duration-300 rounded-xl overflow-hidden shadow-xs hover:shadow-md relative pl-1.5 select-none">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8.5 h-8.5 rounded-lg bg-blue-50 border border-blue-100 text-blue-500 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-400 mb-0.5">Today</p>
            <h3 className="text-2xl font-extrabold text-slate-800 font-display">{stats.todayAppointments}</h3>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-100 hover:border-slate-200 transition-all duration-300 rounded-xl overflow-hidden shadow-xs hover:shadow-md relative pl-1.5 select-none">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8.5 h-8.5 rounded-lg bg-amber-50 border border-amber-100 text-amber-500 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-400 mb-0.5">Pending</p>
            <h3 className="text-2xl font-extrabold text-slate-800 font-display">{stats.pendingCount}</h3>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-100 hover:border-slate-200 transition-all duration-300 rounded-xl overflow-hidden shadow-xs hover:shadow-md relative pl-1.5 select-none">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8.5 h-8.5 rounded-lg bg-primary/5 border border-primary/10 text-primary flex items-center justify-center">
                <CalendarCheck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-400 mb-0.5">Confirmed</p>
            <h3 className="text-2xl font-extrabold text-slate-800 font-display">{stats.confirmedCount}</h3>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-100 hover:border-slate-200 transition-all duration-300 rounded-xl overflow-hidden shadow-xs hover:shadow-md relative pl-1.5 select-none">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8.5 h-8.5 rounded-lg bg-green-50 border border-green-100 text-green-500 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-400 mb-0.5">Completed</p>
            <h3 className="text-2xl font-extrabold text-slate-800 font-display">{stats.completedCount}</h3>
          </CardContent>
        </Card>
      </div>

      {/* Table Card */}
      <Card className="bg-white border-slate-100 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="border-b border-slate-50 bg-slate-50/50 py-4 px-6">
          <CardTitle className="text-sm font-bold text-slate-850 font-display">Recent Appointments</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/30 hover:bg-slate-50/30">
                <TableHead className="font-semibold text-slate-500 py-3 text-xs">Patient</TableHead>
                <TableHead className="font-semibold text-slate-500 py-3 text-xs">Date & Time</TableHead>
                <TableHead className="font-semibold text-slate-500 py-3 text-xs">Problem</TableHead>
                <TableHead className="font-semibold text-slate-500 py-3 text-xs">Phone</TableHead>
                <TableHead className="font-semibold text-slate-500 py-3 text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.recentAppointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-slate-400 py-8 text-xs">
                    No recent appointments
                  </TableCell>
                </TableRow>
              ) : (
                stats.recentAppointments.map((apt) => (
                  <TableRow key={apt.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-semibold text-slate-800 py-3 text-xs">{apt.patientName}</TableCell>
                    <TableCell className="text-slate-500 font-medium py-3 text-xs">
                      {(() => { const d = new Date(apt.appointmentDate); return isNaN(d.getTime()) ? apt.appointmentDate : format(d, "MMM d, yyyy"); })()}
                    </TableCell>
                    <TableCell className="text-slate-500 max-w-[200px] truncate py-3 text-xs" title={apt.patientProblem}>
                      {apt.patientProblem}
                    </TableCell>
                    <TableCell className="text-slate-500 font-medium py-3 text-xs">{apt.patientPhone}</TableCell>
                    <TableCell className="py-2.5">
                      <Select 
                        value={apt.status} 
                        onValueChange={(val: any) => handleStatusChange(apt.id, val)}
                        disabled={updateStatus.isPending}
                      >
                        <SelectTrigger className={`w-28 h-7.5 border rounded-lg shadow-none text-xs font-semibold px-2.5 ${statusColors[apt.status]}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Upgrade Plan Wizard Dialog Modal */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-850 font-display">Upgrade Subscription Plan</DialogTitle>
          </DialogHeader>

          {upgradeStep === "plans" && (
            <div className="space-y-6 py-2">
              <div className="grid grid-cols-3 gap-2">
                {["Monthly", "Quarterly", "Yearly"].map((plan) => (
                  <button
                    key={plan}
                    onClick={() => setSelectedPlan(plan)}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      selectedPlan === plan
                        ? "border-primary bg-primary/5 ring-2 ring-primary/15"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{plan}</div>
                    <div className="text-sm font-extrabold text-slate-800 mt-1 font-display">₹{getPlanPrice(plan)}</div>
                  </button>
                ))}
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
                <h4 className="font-semibold text-slate-700 text-xs">Payment Information</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-200/60 pb-2">
                    <span className="text-slate-400 font-medium">UPI ID:</span>
                    <span className="font-bold text-slate-800 select-all">{subData?.settings?.upiId || "8178141497@jio"}</span>
                  </div>
                  <div className="flex justify-between pt-0.5">
                    <span className="text-slate-400 font-medium">Payable Amount:</span>
                    <span className="font-extrabold text-primary text-sm">₹{getPlanPrice(selectedPlan)}</span>
                  </div>
                </div>

                {subData?.settings?.upiQrCodeUrl && (
                  <div className="flex flex-col items-center pt-2">
                    <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-xs">
                      <ImageWithFallback src={subData.settings.upiQrCodeUrl} alt="UPI QR" className="w-24 h-24 object-contain" />
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowUpgradeModal(false)} className="rounded-lg">
                  Cancel
                </Button>
                <Button onClick={() => setUpgradeStep("upload")} className="rounded-lg">Continue</Button>
              </DialogFooter>
            </div>
          )}

          {upgradeStep === "upload" && (
            <form onSubmit={handleSubmitProof} className="space-y-4 py-2">
              {submitError && (
                <div className="flex items-start gap-2.5 p-3 bg-red-50 text-red-750 text-xs border border-red-100 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Upgrade Request Plan</Label>
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex justify-between text-xs font-bold text-slate-700">
                  <span>{selectedPlan} Plan</span>
                  <span className="text-primary font-extrabold">₹{getPlanPrice(selectedPlan)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Upload Transaction Screenshot</Label>
                <div className="border border-dashed border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center relative hover:bg-slate-50/50 h-32 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    required
                  />
                  {screenshotBase64 ? (
                    <div className="text-center space-y-1">
                      <CheckCircle className="w-7 h-7 text-green-600 mx-auto" />
                      <span className="text-xs text-green-700 font-bold block">Screenshot uploaded!</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setScreenshotBase64("");
                        }}
                        className="text-[10px] text-red-500 hover:underline bg-transparent border-0 cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  ) : (
                    <div className="text-center space-y-1.5">
                      <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
                      <span className="text-xs font-semibold text-slate-700 block">Click to select file</span>
                      <span className="text-[10px] text-slate-400 block">PNG, JPG, JPEG up to 5MB</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="upgrade-notes" className="text-xs text-slate-500">Notes / Transaction ID (Optional)</Label>
                <Textarea
                  id="upgrade-notes"
                  placeholder="Reference number or notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="rounded-lg resize-none"
                />
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setUpgradeStep("plans")} disabled={isSubmitting} className="rounded-lg">
                  Back
                </Button>
                <Button type="submit" disabled={isSubmitting || !screenshotBase64} className="rounded-lg">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Submit Upgrade Request
                </Button>
              </DialogFooter>
            </form>
          )}

          {upgradeStep === "success" && (
            <div className="text-center space-y-4 py-4">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
              <h3 className="text-lg font-bold text-slate-850 font-display">Proof Submitted</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Your payment proof is currently **Awaiting Verification**. Once verified by the platform system owner, your subscription will be activated automatically.
              </p>
              <div className="pt-4">
                <Button onClick={() => setShowUpgradeModal(false)} className="w-full rounded-lg">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
