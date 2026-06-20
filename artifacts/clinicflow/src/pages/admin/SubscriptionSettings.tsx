import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
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
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Subscription Settings</h2>
        <p className="text-gray-500 mt-1 text-sm">Configure payment methods, renewal prices, and support contacts.</p>
      </div>

      <form onSubmit={handleSave}>
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">UPI & Pricing Details</CardTitle>
            <CardDescription>
              These details are used dynamically on the subscription expiry screen for clinic renewals.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-1.5">
              <Label htmlFor="upi-id">Manual UPI ID</Label>
              <Input
                id="upi-id"
                required
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. company@ybl"
              />
            </div>

            {/* QR Code Upload */}
            <div className="space-y-2">
              <Label>UPI QR Code Image</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center relative hover:bg-slate-50/50 transition-colors h-32">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleQrUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {qrBase64 ? (
                    <div className="text-center space-y-1">
                      <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto" />
                      <span className="text-xs font-semibold text-green-700">New QR selected!</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQrBase64("");
                        }}
                        className="text-[10px] text-red-500 hover:underline block mx-auto bg-transparent border-0 p-0 cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  ) : (
                    <div className="text-center space-y-1">
                      <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
                      <span className="text-xs font-semibold text-slate-700 block">Click to upload QR code</span>
                      <span className="text-[10px] text-slate-400 block">PNG, JPG, WEBP up to 2MB</span>
                    </div>
                  )}
                </div>
                {/* Current QR Code Preview */}
                {(currentQrUrl || qrBase64) && (
                  <div className="flex flex-col items-center justify-center bg-slate-50 rounded-xl p-3 border border-slate-100 h-32">
                    <ImageWithFallback
                      src={qrBase64 || currentQrUrl}
                      alt="UPI QR Code Preview"
                      className="h-20 w-20 object-contain"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 font-medium">QR Preview</span>
                  </div>
                )}
              </div>
            </div>

            {/* Price Configurations */}
            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-1">Renewal Pricing (₹)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="monthly-price">Monthly Price</Label>
                  <Input
                    id="monthly-price"
                    type="number"
                    required
                    value={monthlyPrice}
                    onChange={(e) => setMonthlyPrice(e.target.value)}
                    placeholder="999"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quarterly-price">Quarterly Price</Label>
                  <Input
                    id="quarterly-price"
                    type="number"
                    required
                    value={quarterlyPrice}
                    onChange={(e) => setQuarterlyPrice(e.target.value)}
                    placeholder="2699"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="yearly-price">Yearly Price</Label>
                  <Input
                    id="yearly-price"
                    type="number"
                    required
                    value={yearlyPrice}
                    onChange={(e) => setYearlyPrice(e.target.value)}
                    placeholder="8999"
                  />
                </div>
              </div>
            </div>

            {/* Support Contacts */}
            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-1">Support Contact Info</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="support-contact">Support Contact Number</Label>
                  <Input
                    id="support-contact"
                    required
                    value={supportContact}
                    onChange={(e) => setSupportContact(e.target.value)}
                    placeholder="+91 8178141497"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="support-whatsapp">Support WhatsApp Number</Label>
                  <Input
                    id="support-whatsapp"
                    required
                    value={supportWhatsapp}
                    onChange={(e) => setSupportWhatsapp(e.target.value)}
                    placeholder="+91 8178141497"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={saving} className="px-8 py-6">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Subscription Config
          </Button>
        </div>
      </form>
    </div>
  );
}
