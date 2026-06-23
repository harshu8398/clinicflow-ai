import { useState } from "react";
import { 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  UploadCloud, 
  ShieldAlert, 
  Copy, 
  Check, 
  Phone, 
  MessageSquare, 
  ArrowRight, 
  Lock, 
  ChevronRight,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [copied, setCopied] = useState(false);

  const getPlanPrice = (plan: string) => {
    if (plan === "Monthly") return monthlyPrice;
    if (plan === "Quarterly") return quarterlyPrice;
    if (plan === "Yearly") return yearlyPrice;
    return "0";
  };

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  // Format WhatsApp Link
  const cleanWhatsappNumber = supportWhatsapp.replace(/[^0-9]/g, "");
  const whatsappUrl = `https://wa.me/${cleanWhatsappNumber}?text=Hi%20ClinicFlow%20Support,%20I%20have%20a%20question%20about%20my%20subscription.`;

  // If status is Suspended, show suspended block screen
  if (status === "Suspended") {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-350">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-rose-100 text-center space-y-6 animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-rose-100">
            <ShieldAlert className="w-9 h-9" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 font-display">Account Suspended</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Your clinic account access has been suspended by the administrator. Please contact system support to restore your service.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3 text-sm text-left">
            <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <Phone className="w-4 h-4 text-slate-450" /> Call Support
              </span>
              <a href={`tel:${supportContact}`} className="font-semibold text-primary hover:underline">
                {supportContact}
              </a>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <MessageSquare className="w-4 h-4 text-slate-450" /> WhatsApp
              </span>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-650 hover:underline flex items-center gap-1">
                Chat now <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
          <p className="text-[10px] text-slate-400">
            ClinicFlow • Secure Clinical Operations
          </p>
        </div>
      </div>
    );
  }

  // If status is Expired or Rejected, show Expired subscription overlay
  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto animate-in fade-in duration-350">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-100 my-8 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-600/5 to-transparent px-8 py-7 border-b border-slate-100 text-center space-y-2 relative">
          <div className="absolute top-4 right-4 flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-100/50 px-2 py-0.5 rounded-full border border-slate-200/40">
            <Lock className="w-3 h-3" /> Secure Payment
          </div>
          
          <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold uppercase tracking-wider border border-amber-200/50">
            Subscription Inactive
          </div>
          <h2 className="text-2xl font-bold text-slate-900 font-display tracking-tight">Renew Your Clinic License</h2>
          <p className="text-slate-500 text-xs max-w-md mx-auto leading-relaxed">
            Your current billing cycle has ended. Complete the renewal below to resume instant digital receptionist tools, scheduling, and patient logs.
          </p>
        </div>

        <div className="p-8">
          {step === "info" && (
            <div className="space-y-6">
              
              {/* Pricing Cards */}
              <div className="space-y-2.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">1. Select Pricing Plan</Label>
                <div className="grid grid-cols-3 gap-3">
                  {["Monthly", "Quarterly", "Yearly"].map((plan) => {
                    const isSelected = selectedPlan === plan;
                    const price = getPlanPrice(plan);
                    let savings = "";
                    if (plan === "Quarterly") savings = "Save ~10%";
                    if (plan === "Yearly") savings = "Save ~25%";

                    return (
                      <button
                        key={plan}
                        type="button"
                        onClick={() => setSelectedPlan(plan)}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between h-28 ${
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className={`text-[11px] font-bold uppercase tracking-wide ${isSelected ? "text-primary" : "text-slate-400"}`}>
                              {plan}
                            </span>
                            {isSelected && (
                              <span className="w-3.5 h-3.5 rounded-full bg-primary text-white flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </span>
                            )}
                          </div>
                          <div className="text-lg font-extrabold text-slate-900 mt-1 font-display">₹{price}</div>
                        </div>
                        {savings ? (
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full self-start ${
                            isSelected ? "bg-primary/10 text-primary" : "bg-emerald-50 text-emerald-700"
                          }`}>
                            {savings}
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-400">Standard Plan</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* QR and Transfer Details */}
              <div className="space-y-2.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">2. Pay via UPI / QR Code</Label>
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 flex flex-col md:flex-row gap-5 items-center justify-between">
                  <div className="space-y-3.5 flex-1 w-full">
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Scan the QR code with any UPI app (GPay, PhonePe, Paytm) or copy the UPI ID below to complete the transfer manually.
                    </p>
                    
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center text-xs bg-white rounded-lg p-2.5 border border-slate-200/60 shadow-sm">
                        <span className="text-slate-400 font-medium">UPI ID:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-800 select-all">{upiId}</span>
                          <button
                            type="button"
                            onClick={handleCopyUpi}
                            className="p-1 text-slate-450 hover:text-slate-800 hover:bg-slate-100 rounded transition-all cursor-pointer"
                            title="Copy UPI ID"
                          >
                            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-xs bg-white rounded-lg p-2.5 border border-slate-200/60 shadow-sm">
                        <span className="text-slate-400 font-medium">Total Amount Payable:</span>
                        <span className="font-extrabold text-slate-900 font-display">₹{getPlanPrice(selectedPlan)}</span>
                      </div>
                    </div>
                  </div>

                  {qrCodeUrl && (
                    <div className="flex flex-col items-center justify-center shrink-0 p-3 bg-white rounded-xl border border-slate-200/60 shadow-sm">
                      <div className="w-28 h-28 flex items-center justify-center bg-slate-50 rounded-lg overflow-hidden border border-slate-100 p-1">
                        <ImageWithFallback src={qrCodeUrl} alt="UPI QR Code" className="w-full h-full object-contain" />
                      </div>
                      <span className="text-[9px] font-bold text-slate-450 mt-1.5 uppercase tracking-wide">Scan with UPI App</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <Button 
                onClick={() => setStep("upload")} 
                className="w-full py-6 text-sm font-bold rounded-xl shadow-md shadow-primary/10 hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-2 group"
              >
                I have completed the payment
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </div>
          )}

          {step === "upload" && (
            <form onSubmit={handleSubmit} className="space-y-5 animate-in fade-in duration-200">
              {error && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-100">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Selected Renewal License</Label>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex justify-between items-center text-sm">
                  <div>
                    <span className="font-bold text-slate-800 block">{selectedPlan} License</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Recurring billing cycle</span>
                  </div>
                  <span className="text-lg font-extrabold text-slate-900 font-display">₹{getPlanPrice(selectedPlan)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Upload Payment Screenshot</Label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 hover:bg-slate-50/50 transition-all flex flex-col items-center justify-center relative min-h-[160px]">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    required
                  />
                  {screenshotBase64 ? (
                    <div className="text-center space-y-3 z-20">
                      <div className="relative mx-auto w-24 h-24 rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-white group/preview">
                        <img src={screenshotBase64} alt="Screenshot Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-green-700">Receipt loaded successfully!</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setScreenshotBase64("");
                          }}
                          className="text-[10px] text-rose-500 hover:text-rose-700 hover:underline bg-transparent border-0 p-0 cursor-pointer mt-1 font-semibold"
                        >
                          Choose another screenshot
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-2.5 pointer-events-none">
                      <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center mx-auto border border-slate-200/50">
                        <UploadCloud className="w-5.5 h-5.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700">Select payment receipt screenshot</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, JPEG, or WEBP (Max 5MB)</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Notes / Reference / UTR Number</Label>
                <Textarea
                  id="notes"
                  placeholder="e.g. Transaction ID, UTR Number, or any reference notes for faster manual verification"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="resize-none rounded-xl border-slate-200 focus:border-primary focus:ring-primary/20 text-xs min-h-[70px] p-3"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("info")}
                  disabled={isSubmitting}
                  className="w-1/3 py-5 rounded-xl border-slate-200 text-slate-650 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  Back
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting || !screenshotBase64} 
                  className="w-2/3 py-5 rounded-xl text-xs font-bold shadow-md shadow-primary/5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying receipt…
                    </>
                  ) : (
                    "Submit Verification Proof"
                  )}
                </Button>
              </div>
            </form>
          )}

          {step === "success" && (
            <div className="text-center space-y-6 py-6 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-650 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100 shadow-sm relative">
                <CheckCircle2 className="w-9 h-9" />
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 font-display">Receipt Awaiting Verification</h3>
                <p className="text-slate-500 text-xs max-w-sm mx-auto leading-relaxed">
                  Your renewal request has been recorded. The platform owner is validating the payment proof. You will regain access instantly once verified.
                </p>
              </div>
              
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 max-w-sm mx-auto space-y-3.5 text-xs text-left">
                <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                  <span className="text-slate-500 font-medium">Verification Status:</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-100 text-[10px] uppercase">
                    Awaiting Owner Review
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone Support:
                  </span>
                  <a href={`tel:${supportContact}`} className="font-semibold text-slate-700 hover:text-primary transition-colors">
                    {supportContact}
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" /> WhatsApp Support:
                  </span>
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-650 hover:underline flex items-center gap-1">
                    Chat now <ChevronRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <p className="text-[10px] text-slate-450">
                You can keep this tab open or refresh later. Safe clinical practice starts here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
