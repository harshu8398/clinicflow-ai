import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Phone, MessageSquare } from "lucide-react";

export default function ContactUs() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill out all fields.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/contact-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        toast({
          title: "Message Sent",
          description: "Thank you for reaching out! We have received your message and will respond shortly."
        });
        setFormData({ name: "", email: "", message: "" });
      } else {
        const errorData = await res.json();
        toast({
          title: "Failed to Send Message",
          description: errorData.error || "Something went wrong. Please try again.",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Connection Error",
        description: "Could not connect to the server. Please check your connection.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col relative overflow-hidden font-sans">
      {/* Decorative background gradients */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      {/* Navigation Header */}
      <header className="w-full bg-white/70 backdrop-blur-md border-b border-slate-100 sticky top-0 z-40 transition-all duration-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer">
              <img 
                src="/logo.png" 
                alt="ClinicFlow Logo" 
                className="h-10 w-auto object-contain shrink-0"
              />
              <div>
                <span className="text-xl font-bold tracking-tight text-slate-900 block leading-tight font-display">
                  ClinicFlow
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block leading-none">
                  Your 24x7 Digital Receptionist
                </span>
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium cursor-pointer">
                Clinic Login
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl w-full mx-auto px-6 py-16 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
          
          {/* Contact Details Column */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-8 bg-slate-900 text-white rounded-3xl p-8 sm:p-12 shadow-lg relative overflow-hidden">
            {/* Subtle background glow */}
            <div className="absolute right-0 bottom-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-6 relative z-10">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary border border-primary/30 text-xs font-semibold uppercase tracking-wider">
                📞 Get In Touch
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-display leading-tight">
                ClinicFlow Support & Inquiry Channels
              </h1>
              <p className="text-slate-400 text-sm leading-relaxed">
                Have questions about our smart AI receptionist or dashboard operations? Our support channels are online to help you integrate and manage your healthcare practice.
              </p>
            </div>

            <div className="space-y-6 relative z-10 pt-8 border-t border-slate-800">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-primary shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Support Email</span>
                  <a href="mailto:jha753430@gmail.com" className="font-bold text-white mt-0.5 hover:underline text-sm sm:text-base">
                    jha753430@gmail.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-primary shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Support Phone</span>
                  <a href="tel:8178141497" className="font-bold text-white mt-0.5 hover:underline text-sm sm:text-base">
                    +91 8178141497
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-primary shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Support WhatsApp</span>
                  <a href="https://wa.me/918178141497" target="_blank" rel="noreferrer" className="font-bold text-white mt-0.5 hover:underline text-sm sm:text-base">
                    +91 8178141497
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Form Column */}
          <div className="lg:col-span-7 bg-white border border-slate-100 rounded-3xl p-8 sm:p-12 shadow-sm flex flex-col justify-center">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 font-display mb-2">Send Us a Message</h2>
            <p className="text-xs text-slate-400 mb-8">Drop us a line and our system administration team will get back to you within 24 hours.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-slate-700 font-semibold text-xs">Name</Label>
                <Input
                  id="name"
                  placeholder="Your Full Name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="rounded-lg border-slate-200 text-xs sm:text-sm h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-slate-700 font-semibold text-xs">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="rounded-lg border-slate-200 text-xs sm:text-sm h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="message" className="text-slate-700 font-semibold text-xs">Message</Label>
                <Textarea
                  id="message"
                  placeholder="How can we help your clinic today?"
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="rounded-lg border-slate-200 text-xs sm:text-sm min-h-[120px]"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 font-semibold text-sm shadow-sm rounded-lg mt-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Sending Message...
                  </>
                ) : (
                  "Submit Message"
                )}
              </Button>
            </form>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-white border-t border-slate-100 py-8 mt-auto">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500 font-medium">
          <div>
            © {new Date().getFullYear()} ClinicFlow. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy-policy">
              <span className="hover:text-primary transition-colors cursor-pointer">Privacy Policy</span>
            </Link>
            <Link href="/terms-and-conditions">
              <span className="hover:text-primary transition-colors cursor-pointer">Terms & Conditions</span>
            </Link>
            <Link href="/contact-us">
              <span className="hover:text-primary transition-colors cursor-pointer">Contact Us</span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
