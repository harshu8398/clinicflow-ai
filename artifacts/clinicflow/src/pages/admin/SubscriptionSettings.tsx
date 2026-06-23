import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, Save, Sparkles, HelpCircle, Phone, MessageSquare, IndianRupee, QrCode } from "lucide-react";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";

export default function SubscriptionSettings() {
  const [upiId, setUpiId] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [quarterlyPrice, setQuarterlyPrice] = useState("");
  const [yearlyPrice, setYearlyPrice] = useState("");
  const [supportContact, setSupportContact] = useState("");
  const [supportWhatsapp, setSupportWhatsapp] = useState("");

  const [qrBase64, setQrBase64] = useState("");
  const [currentQrUrl, setCurrentQrUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/subscriptions/settings`,
          { credentials: "include" }
        );
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setUpiId(data.upiId || "");
            setMonthlyPrice(data.monthlyPrice || "");
            setQuarterlyPrice(data.quarterlyPrice || "");
            setYearlyPrice(data.yearlyPrice || "");
            setSupportContact(data.supportContact || "");
            setSupportWhatsapp(data.supportWhatsapp || "");
            if (data.upiQrCodeUrl) {
              setCurrentQrUrl(data.upiQrCodeUrl);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      toast({ title: "Unsupported format", description: "Only PNG, JPG, JPEG, and WEBP are supported.", variant: "destructive" });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "QR code must be under 2MB.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setQrBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upiId || !monthlyPrice || !quarterlyPrice || !yearlyPrice || !supportContact || !supportWhatsapp) {
      toast({ title: "Validation Error", description: "All fields are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/subscriptions/settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            upiId,
            upiQrCode: qrBase64 || null,
            monthlyPrice,
            quarterlyPrice,
            yearlyPrice,
            supportContact,
            supportWhatsapp,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save settings");
      }

      const updated = await res.json();
      if (updated.upiQrCodeUrl) {
        setCurrentQrUrl(updated.upiQrCodeUrl);
        setQrBase64(""); // Clear base64 once saved
      }

      toast({ title: "Settings Saved", description: "Pricing and UPI settings updated successfully" });
    } catch (err: any) {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[300px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 font-display tracking-tight">Subscription Settings</h2>
        <p className="text-xs text-slate-400 mt-1">Configure payment methods, renewal prices, and support contacts for clinics.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="bg-white border-slate-100 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-slate-50 bg-slate-50/50 py-5 px-6">
            <CardTitle className="text-base font-bold text-slate-800 font-display flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
                <QrCode className="w-4 h-4" />
              </div>
              UPI & Pricing Configuration
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-1">
              These details are used dynamically on the subscription expiry screen for clinic manual renewals.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            {/* UPI ID */}
            <div className="space-y-1.5">
              <Label htmlFor="upi-id" className="text-xs font-semibold text-slate-550 uppercase tracking-wider block">Manual UPI ID</Label>
              <Input
                id="upi-id"
                required
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. company@ybl"
                className="h-10 text-xs border-slate-200"
              />
            </div>

            {/* QR Code Upload */}
            <div className="space-y-2.5">
              <Label className="text-xs font-semibold text-slate-550 uppercase tracking-wider block">UPI QR Code Image</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center relative hover:bg-slate-50/50 transition-all h-32 cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleQrUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  {qrBase64 ? (
                    <div className="text-center space-y-1 z-20">
                      <CheckCircle2 className="w-7 h-7 text-green-600 mx-auto" />
                      <span className="text-[11px] font-bold text-green-700 block">New QR selected!</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQrBase64("");
                        }}
                        className="text-[10px] font-bold text-rose-500 hover:text-rose-700 hover:underline block mx-auto bg-transparent border-0 p-0 cursor-pointer mt-1"
                      >
                        Change QR
                      </button>
                    </div>
                  ) : (
                    <div className="text-center space-y-1.5 pointer-events-none">
                      <UploadCloud className="w-7 h-7 text-slate-400 mx-auto" />
                      <span className="text-xs font-bold text-slate-700 block">Upload UPI QR code</span>
                      <span className="text-[10px] text-slate-400 block">PNG, JPG, WEBP up to 2MB</span>
                    </div>
                  )}
                </div>
                {/* Current QR Code Preview */}
                {(currentQrUrl || qrBase64) && (
                  <div className="flex flex-col items-center justify-center bg-slate-50/50 rounded-xl p-3 border border-slate-100 h-32">
                    <div className="h-20 w-20 bg-white border border-slate-200 rounded-lg overflow-hidden p-1 flex items-center justify-center shadow-sm">
                      <ImageWithFallback
                        src={qrBase64 || currentQrUrl}
                        alt="UPI QR Code Preview"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <span className="text-[9px] text-slate-450 mt-1.5 uppercase font-bold tracking-wider">Active QR Preview</span>
                  </div>
                )}
              </div>
            </div>

            {/* Price Configurations */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-bold text-slate-650 uppercase tracking-wider border-b border-slate-100 pb-2">Renewal Pricing (₹)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="monthly-price" className="text-xs font-semibold text-slate-550 uppercase tracking-wider block">Monthly Price</Label>
                  <div className="relative">
                    <Input
                      id="monthly-price"
                      type="number"
                      required
                      value={monthlyPrice}
                      onChange={(e) => setMonthlyPrice(e.target.value)}
                      placeholder="999"
                      className="h-10 text-xs border-slate-200 pl-8.5"
                    />
                    <IndianRupee className="w-3.5 h-3.5 text-slate-450 absolute left-3 top-3.5" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quarterly-price" className="text-xs font-semibold text-slate-550 uppercase tracking-wider block">Quarterly Price</Label>
                  <div className="relative">
                    <Input
                      id="quarterly-price"
                      type="number"
                      required
                      value={quarterlyPrice}
                      onChange={(e) => setQuarterlyPrice(e.target.value)}
                      placeholder="2699"
                      className="h-10 text-xs border-slate-200 pl-8.5"
                    />
                    <IndianRupee className="w-3.5 h-3.5 text-slate-450 absolute left-3 top-3.5" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="yearly-price" className="text-xs font-semibold text-slate-550 uppercase tracking-wider block">Yearly Price</Label>
                  <div className="relative">
                    <Input
                      id="yearly-price"
                      type="number"
                      required
                      value={yearlyPrice}
                      onChange={(e) => setYearlyPrice(e.target.value)}
                      placeholder="8999"
                      className="h-10 text-xs border-slate-200 pl-8.5"
                    />
                    <IndianRupee className="w-3.5 h-3.5 text-slate-450 absolute left-3 top-3.5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Support Contacts */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-bold text-slate-650 uppercase tracking-wider border-b border-slate-100 pb-2">Support Contact Info</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="support-contact" className="text-xs font-semibold text-slate-550 uppercase tracking-wider block">Support Call Number</Label>
                  <div className="relative">
                    <Input
                      id="support-contact"
                      required
                      value={supportContact}
                      onChange={(e) => setSupportContact(e.target.value)}
                      placeholder="+91 8178141497"
                      className="h-10 text-xs border-slate-200 pl-8.5"
                    />
                    <Phone className="w-3.5 h-3.5 text-slate-450 absolute left-3 top-3.5" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="support-whatsapp" className="text-xs font-semibold text-slate-550 uppercase tracking-wider block">Support WhatsApp Number</Label>
                  <div className="relative">
                    <Input
                      id="support-whatsapp"
                      required
                      value={supportWhatsapp}
                      onChange={(e) => setSupportWhatsapp(e.target.value)}
                      placeholder="+91 8178141497"
                      className="h-10 text-xs border-slate-200 pl-8.5"
                    />
                    <MessageSquare className="w-3.5 h-3.5 text-slate-450 absolute left-3 top-3.5" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-2">
          <Button 
            type="submit" 
            disabled={saving} 
            className="w-full sm:w-auto h-11 px-6 text-xs font-bold rounded-xl shadow-md shadow-primary/5 active:scale-97 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving Changes…
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Configurations
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
