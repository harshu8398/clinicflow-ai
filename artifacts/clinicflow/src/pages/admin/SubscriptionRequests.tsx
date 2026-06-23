import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, X, Eye, Calendar, FileText, Loader2, RefreshCw } from "lucide-react";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";

export default function SubscriptionRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeScreenshot, setActiveScreenshot] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<number | null>(null);
  const { toast } = useToast();

  const fetchRequests = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/subscriptions/requests`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error("Failed to load subscription requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleResolveRequest = async (requestId: number, action: "approve" | "reject") => {
    setActionPending(requestId);
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/subscriptions/requests/${requestId}/${action}`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to ${action} request`);
      }

      toast({
        title: action === "approve" ? "Payment Approved" : "Payment Rejected",
        description: action === "approve" ? "Subscription activated successfully" : "Request updated to Rejected",
      });
      fetchRequests();
    } catch (err: any) {
      toast({
        title: "Action Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setActionPending(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 font-display tracking-tight">Payment Verification Requests</h2>
          <p className="text-xs text-slate-400 mt-1">Verify screenshots and approve or reject manual subscription renewals.</p>
        </div>
        <Button variant="outline" onClick={fetchRequests} className="h-10 border-slate-200 hover:bg-slate-50 font-semibold text-xs px-4 cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5 mr-2" /> Refresh List
        </Button>
      </div>

      {loading ? (
        <div className="min-h-[300px] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : requests.length === 0 ? (
        <Card className="p-16 text-center border-dashed border-slate-200 rounded-xl">
          <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-6 h-6 text-slate-350" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 font-display mb-1">No pending requests</h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            All submitted receipt proofs have been verified. No clinics require manual billing activation right now.
          </p>
        </Card>
      ) : (
        <div className="grid gap-5">
          {requests.map((req) => {
            const statusColors: any = {
              "Pending Verification": "bg-amber-50 text-amber-700 border-amber-100",
              Approved: "bg-green-50 text-green-700 border-green-100",
              Rejected: "bg-red-50 text-red-700 border-red-100",
            };

            const isPending = req.status === "Pending Verification";

            return (
              <Card
                key={req.id}
                className="bg-white border-slate-100 shadow-sm hover:shadow-md transition-all rounded-xl overflow-hidden"
              >
                <div className="flex flex-col lg:flex-row">
                  {/* Left Column: Details */}
                  <div className="p-6 flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <h4 className="font-bold text-slate-800 text-lg font-display">{req.clinicName}</h4>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                          statusColors[req.status] || "bg-slate-50 border-slate-100 text-slate-500"
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs">
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Plan Requested</span>
                        <span className="font-bold text-slate-700 uppercase flex items-center gap-1.5 mt-1">
                          <RefreshCw className="w-3.5 h-3.5 text-primary shrink-0" /> {req.planType} Plan
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Amount Paid</span>
                        <span className="font-extrabold text-slate-900 mt-1 block font-display">
                          ₹{req.amount}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Submitted Date</span>
                        <span className="font-medium text-slate-650 flex items-center gap-1.5 mt-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {new Date(req.submittedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {req.notes && (
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs text-slate-650 leading-relaxed">
                        <strong className="block text-slate-800 font-bold mb-1">Notes / Transaction ID:</strong>
                        {req.notes}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Screenshot & Approval Actions */}
                  <div className="bg-slate-50/50 p-6 border-t lg:border-t-0 lg:border-l border-slate-100/80 flex flex-row lg:flex-col items-center justify-center gap-4 shrink-0 lg:w-80">
                    <div className="flex flex-col items-center gap-1.5 flex-1 w-full">
                      <button
                        type="button"
                        onClick={() => setActiveScreenshot(req.screenshotUrl)}
                        className="relative w-full aspect-video sm:w-48 bg-white border border-slate-200 rounded-xl overflow-hidden group shadow-sm hover:opacity-95 transition-opacity cursor-pointer flex items-center justify-center p-1"
                      >
                        <ImageWithFallback
                          src={req.screenshotUrl}
                          alt="Screenshot Proof"
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold gap-1.5">
                          <Eye className="w-4 h-4" /> View Screenshot
                        </div>
                      </button>
                    </div>

                    {isPending && (
                      <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full shrink-0">
                        <Button
                          onClick={() => handleResolveRequest(req.id, "approve")}
                          disabled={actionPending !== null}
                          className="bg-green-600 hover:bg-green-700 text-white w-full sm:flex-1 lg:flex-initial h-9 text-xs font-bold rounded-lg cursor-pointer"
                        >
                          {actionPending === req.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4 mr-1.5" />
                          )}
                          Approve Payment
                        </Button>
                        <Button
                          onClick={() => handleResolveRequest(req.id, "reject")}
                          disabled={actionPending !== null}
                          variant="destructive"
                          className="w-full sm:flex-1 lg:flex-initial h-9 text-xs font-bold rounded-lg cursor-pointer"
                        >
                          {actionPending === req.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <X className="w-4 h-4 mr-1.5" />
                          )}
                          Reject Request
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Screenshot Modal Lightbox */}
      <Dialog open={activeScreenshot !== null} onOpenChange={(open) => !open && setActiveScreenshot(null)}>
        <DialogContent className="max-w-2xl bg-slate-900 border-0 text-white p-6">
          <DialogHeader>
            <DialogTitle className="text-white font-bold text-base font-display">Receipt Verification Proof</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-2 bg-slate-950 rounded-xl overflow-hidden mt-3 shadow-inner">
            {activeScreenshot && (
              <ImageWithFallback
                src={activeScreenshot}
                alt="Enlarged screenshot proof"
                className="max-h-[70vh] w-full object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
