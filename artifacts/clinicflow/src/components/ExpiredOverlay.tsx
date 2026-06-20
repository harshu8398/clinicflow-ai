import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, UploadCloud, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";

interface ExpiredOverlayProps {
  status: string;
  planType: string;
  upiId: string;
  qrCodeUrl?: string;
  monthlyPrice: string;
  quarterlyPrice: string;
  yearlyPrice: string;
  supportContact: string;
  supportWhatsapp: string;
  onSubmitProof: (plan: string, amount: string, base64Image: string, notes: string) => Promise<void>;
  isLoadingStatus: boolean;
}

export default function ExpiredOverlay({
  status,
  planType,
  upiId,
  qrCodeUrl,
  monthlyPrice,
  quarterlyPrice,
  yearlyPrice,
  supportContact,
  supportWhatsapp,
  onSubmitProof,
  isLoadingStatus
}: ExpiredOverlayProps) {
  const [step, setStep] = useState<"info" | "upload" | "success">(
    status === "Pending Verification" ? "success" : "info"
  );
  
  const [selectedPlan, setSelectedPlan] = useState("Monthly");
  const [screenshotBase64, setScreenshotBase64] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const getPlanPrice = (plan: string) => {
    if (plan === "Monthly") return monthlyPrice;
    if (plan === "Quarterly") return quarterlyPrice;
    if (plan === "Yearly") return yearlyPrice;
    return "0";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;

    // Type check: PNG, JPG, JPEG, WEBP
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Supported file types are PNG, JPG, JPEG, and WEBP.");
      return;
    }

    // Size check: 5 MB
    if (file.size > 5 * 1024 * 1024) {
      setError("File size must not exceed 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshotBase64(reader.result as string);
    };
    reader.onerror = () => {
      setError("Failed to read file.");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!screenshotBase64) {
      setError("Please upload a payment screenshot.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      const price = getPlanPrice(selectedPlan);
      await onSubmitProof(selectedPlan, price, screenshotBase64, notes);
      setStep("success");
    } catch (err: any) {
      setError(err.message || "Failed to submit verification request");
    } finally {
      setIsSubmitting(false);
    }
  };

  // If status is Suspended, show suspended block screen
  if (status === "Suspended") {
    return (
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-red-100 text-center space-y-6">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <ShieldAlert className="w-10 h-10 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">Account Suspended</h2>
            <p className="text-gray-500 text-sm">
              Your clinic account has been suspended. Please contact support to resolve this issue.
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2 text-sm text-left">
            <div className="flex justify-between">
              <span className="text-gray-500">Support Phone:</span>
              <span className="font-semibold text-slate-800">{supportContact}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Support WhatsApp:</span>
              <span className="font-semibold text-slate-800">{supportWhatsapp}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If status is Expired or Rejected, show Expired subscription overlay
  return (
    <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-amber-100 my-8 overflow-hidden">
        {/* Header */}
        <div className="bg-amber-50 px-8 py-6 border-b border-amber-100 text-center space-y-2">
          <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold uppercase tracking-wider">
            Subscription Expired
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Your subscription has expired</h2>
          <p className="text-slate-500 text-sm">
            Please renew your subscription to restore full functionality and continue using the system.
          </p>
        </div>

        <div className="p-8">
          {step === "info" && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-3">
                {["Monthly", "Quarterly", "Yearly"].map((plan) => (
                  <button
                    key={plan}
                    onClick={() => setSelectedPlan(plan)}
                    className={`p-4 rounded-xl border text-center transition-all cursor-pointer ${
                      selectedPlan === plan
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-500 uppercase">{plan}</div>
                    <div className="text-lg font-bold text-slate-900 mt-1">₹{getPlanPrice(plan)}</div>
                  </button>
                ))}
              </div>

              <div className="bg-slate-50 rounded-xl p-6 border border-slate-100 space-y-4">
                <h3 className="font-semibold text-slate-800 text-sm">Payment Instructions</h3>
                <p className="text-xs text-slate-500">
                  Please scan the QR code or transfer the exact plan amount manually to our UPI ID below. Click **"I've Paid"** once the transaction is complete to upload proof.
                </p>

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-sm border-b border-slate-200/60 pb-2">
                    <span className="text-slate-500">UPI ID:</span>
                    <span className="font-semibold text-slate-800 select-all">{upiId}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Payable Amount:</span>
                    <span className="font-bold text-slate-900">₹{getPlanPrice(selectedPlan)}</span>
                  </div>
                </div>

                {qrCodeUrl && (
                  <div className="flex flex-col items-center justify-center pt-2">
                    <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-sm">
                      <ImageWithFallback src={qrCodeUrl} alt="UPI QR Code" className="w-32 h-32 object-contain" />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1">Scan to pay with any UPI App</span>
                  </div>
                )}
              </div>

              <Button onClick={() => setStep("upload")} className="w-full py-6 text-sm font-semibold">
                I've Paid
              </Button>
            </div>
          )}

          {step === "upload" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-100">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs text-slate-500 font-semibold">Selected Renewal Plan</Label>
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex justify-between items-center text-sm">
                  <span className="font-medium text-slate-800">{selectedPlan} Plan</span>
                  <span className="font-bold text-slate-900">₹{getPlanPrice(selectedPlan)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 font-semibold">Upload Payment Screenshot (Required)</Label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 hover:bg-slate-50/50 transition-colors flex flex-col items-center justify-center relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    required
                  />
                  {screenshotBase64 ? (
                    <div className="text-center space-y-2">
                      <div className="w-16 h-16 bg-green-50 text-green-600 rounded-lg flex items-center justify-center mx-auto border border-green-100">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <p className="text-xs font-medium text-green-700">Screenshot selected successfully!</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setScreenshotBase64("");
                        }}
                        className="text-[10px] text-red-500 hover:underline bg-transparent border-0 p-0 cursor-pointer"
                      >
                        Change Image
                      </button>
                    </div>
                  ) : (
                    <div className="text-center space-y-2">
                      <UploadCloud className="w-10 h-10 text-slate-400 mx-auto" />
                      <p className="text-xs font-semibold text-slate-700">Click to upload or drag & drop</p>
                      <p className="text-[10px] text-slate-400">PNG, JPG, JPEG, WEBP up to 5MB</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs text-slate-500 font-semibold">Optional Notes / Transaction ID</Label>
                <Textarea
                  id="notes"
                  placeholder="e.g. Transaction ID or any notes for verification"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="resize-none"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("info")}
                  disabled={isSubmitting}
                  className="w-1/3"
                >
                  Back
                </Button>
                <Button type="submit" disabled={isSubmitting || !screenshotBase64} className="w-2/3">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    "Submit Verification Request"
                  )}
                </Button>
              </div>
            </form>
          )}

          {step === "success" && (
            <div className="text-center space-y-6 py-4">
              <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto border border-green-100 shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">Payment Proof Submitted</h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto">
                  Your payment verification request has been successfully submitted and is currently **Awaiting Verification**.
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 max-w-sm mx-auto text-xs text-slate-600">
                Our team will verify your transaction manually and activate your subscription shortly. Thank you for your patience!
              </div>
              <div className="pt-2 text-xs text-slate-400">
                Need help? Contact Support at <span className="font-semibold text-slate-600">{supportContact}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
