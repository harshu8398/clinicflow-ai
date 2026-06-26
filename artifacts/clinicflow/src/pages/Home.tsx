import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useCreateClinic } from "@workspace/api-client-react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowRight, 
  Loader2, 
  Hospital, 
  CheckCircle2, 
  Clock, 
  Users, 
  Calendar, 
  Shield, 
  FileText, 
  Sparkles, 
  TrendingUp, 
  Check, 
  CalendarDays, 
  Laptop,
  CheckCircle,
  Link as LinkIcon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [, setLocation] = useLocation();
  const createClinic = useCreateClinic();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [openDemo, setOpenDemo] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("register") === "true") {
      setOpen(true);
    }
  }, []);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    address: "",
    fee: "",
    timings: ""
  });

  const [demoFormData, setDemoFormData] = useState({
    name: "",
    email: "",
    clinicName: "",
    mobileNumber: "",
    city: "",
    notes: ""
  });
  const [submittingDemo, setSubmittingDemo] = useState(false);

  const getToken = useMutation({
    mutationFn: async (clinicId: number) => {
      const res = await fetch(`/api/clinics/${clinicId}/chat/token`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to get access token");
      const data = await res.json() as { token: string };
      return { clinicId, token: data.token };
    },
    onSuccess: ({ clinicId, token }) => {
      setLocation(`/chat/${clinicId}?token=${token}`);
    },
    onError: () => {
      toast({ title: "Could not open chat. Please try again.", variant: "destructive" });
    },
  });

  const handleClinicSelect = (clinicId: number) => {
    getToken.mutate(clinicId);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createClinic.mutate({ data: formData }, {
      onSuccess: (newClinic) => {
        toast({ title: "Clinic created successfully" });
        setOpen(false);
        handleClinicSelect(newClinic.id);
      },
      onError: () => {
        toast({ title: "Failed to create clinic", variant: "destructive" });
      }
    });
  };

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingDemo(true);
    try {
      const res = await fetch("/api/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: demoFormData.name,
          clinicName: demoFormData.clinicName,
          mobileNumber: demoFormData.mobileNumber,
          email: demoFormData.email,
          city: demoFormData.city,
          notes: demoFormData.notes
        })
      });
      
      if (res.ok) {
        toast({
          title: "Demo Request Received",
          description: `Thank you, ${demoFormData.name}! We will reach out to ${demoFormData.email} shortly to schedule your personalized live demo.`
        });
        setOpenDemo(false);
        setDemoFormData({ name: "", email: "", clinicName: "", mobileNumber: "", city: "", notes: "" });
      } else {
        const data = await res.json();
        toast({
          title: "Submission Failed",
          description: data.error || "Failed to submit demo request. Please try again.",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Network Error",
        description: "Failed to connect to server. Please check your connection.",
        variant: "destructive"
      });
    } finally {
      setSubmittingDemo(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col relative overflow-hidden font-sans pb-16">
      {/* Decorative background grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      
      {/* Navigation Header */}
      <header className="w-full bg-white/70 backdrop-blur-md border-b border-slate-100 sticky top-0 z-40 transition-all duration-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
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
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium" onClick={() => setLocation("/login")}>
              Clinic Login
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="shadow-sm shadow-primary/10 font-medium">Register Clinic</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader className="space-y-1">
                  <DialogTitle className="text-xl font-bold font-display">Register New Clinic</DialogTitle>
                  <p className="text-sm text-slate-500">Create a digital receptionist profile for your clinic today.</p>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Clinic Name</Label>
                      <Input id="name" placeholder="e.g. Metro Dental Care" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="rounded-lg" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="email">Admin Email</Label>
                        <Input id="email" type="email" placeholder="email@clinic.com" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="rounded-lg" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" type="password" placeholder="••••••••" required minLength={6} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="rounded-lg" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="address">Address</Label>
                      <Input id="address" placeholder="123 Medical Row, City" required value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="rounded-lg" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="fee">Consultation Fee</Label>
                        <Input id="fee" placeholder="e.g. ₹500" required value={formData.fee} onChange={e => setFormData({ ...formData, fee: e.target.value })} className="rounded-lg" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="timings">Timings</Label>
                        <Input id="timings" placeholder="e.g. 9 AM - 6 PM" required value={formData.timings} onChange={e => setFormData({ ...formData, timings: e.target.value })} className="rounded-lg" />
                      </div>
                    </div>
                  </div>
                  <Button type="submit" className="w-full mt-2 font-semibold shadow-sm" disabled={createClinic.isPending}>
                    {createClinic.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Create Profile
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl w-full mx-auto px-6 pt-16 flex-1 flex flex-col space-y-24 relative z-10">
        
        {/* Hero Section */}
        <section className="text-center max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-semibold uppercase tracking-wider mb-2">
            🚀 Professional Clinic Automation SaaS
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-none font-display">
            Manage Patients, Appointments <br/>
            <span className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              & Clinic Operations Automatically
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
            ClinicFlow provides you with a smart, 24/7 AI Patient Receptionist and an all-in-one operations dashboard to elevate patient care and streamline your medical practice.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button onClick={() => setOpen(true)} size="lg" className="h-12 px-8 text-base font-semibold shadow-md shadow-primary/20 gap-2 w-full sm:w-auto">
              Register Your Clinic <ArrowRight className="w-4 h-4" />
            </Button>
            <Dialog open={openDemo} onOpenChange={setOpenDemo}>
              <DialogTrigger asChild>
                <Button variant="outline" size="lg" className="h-12 px-8 text-slate-700 border-slate-200 hover:bg-slate-50 font-semibold w-full sm:w-auto">
                  Book Free Demo
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader className="space-y-1">
                  <DialogTitle className="text-xl font-bold font-display">Request a Free Live Demo</DialogTitle>
                  <p className="text-sm text-slate-500">Submit your details to experience ClinicFlow's interactive AI assistant and admin features risk-free.</p>
                </DialogHeader>
                <form onSubmit={handleDemoSubmit} className="space-y-4 pt-2">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="demo-name">Your Name</Label>
                      <Input id="demo-name" placeholder="Dr. Jane Smith" required value={demoFormData.name} onChange={e => setDemoFormData({ ...demoFormData, name: e.target.value })} className="rounded-lg" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="demo-email">Work Email</Label>
                      <Input id="demo-email" type="email" placeholder="jane@clinicflow.com" required value={demoFormData.email} onChange={e => setDemoFormData({ ...demoFormData, email: e.target.value })} className="rounded-lg" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="demo-clinic">Clinic Name</Label>
                      <Input id="demo-clinic" placeholder="Smith Dental Care" required value={demoFormData.clinicName} onChange={e => setDemoFormData({ ...demoFormData, clinicName: e.target.value })} className="rounded-lg" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="demo-mobile">Mobile Number</Label>
                        <Input id="demo-mobile" type="tel" placeholder="e.g. 9876543210" required value={demoFormData.mobileNumber} onChange={e => setDemoFormData({ ...demoFormData, mobileNumber: e.target.value })} className="rounded-lg" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="demo-city">City</Label>
                        <Input id="demo-city" placeholder="e.g. Mumbai" required value={demoFormData.city} onChange={e => setDemoFormData({ ...demoFormData, city: e.target.value })} className="rounded-lg" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="demo-notes">Additional Notes</Label>
                      <Textarea id="demo-notes" placeholder="Tell us about your team size or specific automation needs..." value={demoFormData.notes} onChange={e => setDemoFormData({ ...demoFormData, notes: e.target.value })} className="rounded-lg min-h-[80px]" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full font-semibold shadow-sm" disabled={submittingDemo}>
                    {submittingDemo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Schedule My Free Walkthrough
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </section>

        {/* How ClinicFlow Works */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-100 shadow-sm space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 font-display">How ClinicFlow Works</h2>
            <p className="text-base text-slate-600 leading-relaxed">
              A complete digital receptionist and clinic management platform designed to automate bookings, reduce staff workload, and improve patient experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 relative">
            {/* Step 1 */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-3 group relative">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg border border-primary/20 shrink-0">
                1
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Doctor registers clinic</h3>
              <p className="text-sm text-slate-500">
                Create your clinic account in minutes and set up your practice profile.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-3 group relative">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg border border-blue-100 shrink-0">
                2
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Get your unique booking link</h3>
              <p className="text-sm text-slate-500">
                Every clinic receives a private booking page that can be shared anywhere online.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-3 group relative">
              <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-lg border border-violet-100 shrink-0">
                3
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Share your booking link</h3>
              <div className="text-sm text-slate-500 space-y-1.5 w-full">
                <span className="block font-medium text-slate-700">Display examples:</span>
                <div className="flex flex-wrap justify-center md:justify-start gap-1">
                  {["Google Business", "Instagram Bio", "WhatsApp", "Facebook Page", "Personal Website"].map((item) => (
                    <span key={item} className="inline-block bg-slate-50 text-slate-600 border border-slate-100 rounded-full px-2 py-0.5 text-xs font-medium">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-3 group relative">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg border border-emerald-100 shrink-0">
                4
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Patients book online</h3>
              <p className="text-sm text-slate-500">
                Patients can book appointments 24/7 without calling your clinic.
              </p>
            </div>

            {/* Step 5 */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-3 group relative">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg border border-amber-100 shrink-0">
                5
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Manage from dashboard</h3>
              <p className="text-sm text-slate-500">
                Appointments, patient records, prescriptions, schedules, and clinic operations are managed in one place.
              </p>
            </div>
          </div>
        </section>

        {/* Why Clinics Choose ClinicFlow */}
        <section className="space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 font-display">Why Clinics Choose ClinicFlow</h2>
            <p className="text-base text-slate-600">
              We design medical workflow solutions built to satisfy healthcare providers and delight patient clients alike.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <Card className="border-slate-100 bg-white hover:border-primary/40 hover:shadow-md transition-all duration-300 rounded-2xl">
              <CardHeader className="pb-3 flex flex-row items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <CardTitle className="text-lg font-bold text-slate-800 font-display">24/7 Appointment Booking</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Patients can book appointments at their absolute convenience, even when your clinic is closed.
                </p>
              </CardContent>
            </Card>

            {/* Card 2 */}
            <Card className="border-slate-100 bg-white hover:border-primary/40 hover:shadow-md transition-all duration-300 rounded-2xl">
              <CardHeader className="pb-3 flex flex-row items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <CardTitle className="text-lg font-bold text-slate-800 font-display">Save Staff Time</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Significantly reduce manual phone calls, scheduling errors, and the receptionist's daily administrative workload.
                </p>
              </CardContent>
            </Card>

            {/* Card 3 */}
            <Card className="border-slate-100 bg-white hover:border-primary/40 hover:shadow-md transition-all duration-300 rounded-2xl">
              <CardHeader className="pb-3 flex flex-row items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <CardTitle className="text-lg font-bold text-slate-800 font-display">Never Miss a Patient</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Never miss out on potential inquiries. Our digital scheduler captures requests and book patients automatically.
                </p>
              </CardContent>
            </Card>

            {/* Card 4 */}
            <Card className="border-slate-100 bg-white hover:border-primary/40 hover:shadow-md transition-all duration-300 rounded-2xl">
              <CardHeader className="pb-3 flex flex-row items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <CardTitle className="text-lg font-bold text-slate-800 font-display">Google Calendar Sync</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Seamlessly sync confirmed appointments into your personal and professional Google Calendar automatically.
                </p>
              </CardContent>
            </Card>

            {/* Card 5 */}
            <Card className="border-slate-100 bg-white hover:border-primary/40 hover:shadow-md transition-all duration-300 rounded-2xl">
              <CardHeader className="pb-3 flex flex-row items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <CardTitle className="text-lg font-bold text-slate-800 font-display">Patient Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Safeguard clinical information, trace historical patient consultation notes, and log client details securely.
                </p>
              </CardContent>
            </Card>

            {/* Card 6 */}
            <Card className="border-slate-100 bg-white hover:border-primary/40 hover:shadow-md transition-all duration-300 rounded-2xl">
              <CardHeader className="pb-3 flex flex-row items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <CardTitle className="text-lg font-bold text-slate-800 font-display">Digital Prescriptions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Draft, customize, and issue standard clinical prescription notes digitally in a matter of seconds.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Business Impact Section */}
        <section className="bg-slate-900 text-white rounded-3xl p-8 sm:p-12 shadow-xl relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute right-0 bottom-0 w-80 h-80 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10">
            <div className="lg:col-span-5 space-y-4">
              <h2 className="text-3xl font-bold tracking-tight text-white font-display">How Much Time Can ClinicFlow Save?</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                By replacing traditional telephone queues and manual bookings with smart AI scheduling, we give healthcare practitioners their time back.
              </p>
              <div className="pt-4 grid grid-cols-2 gap-4">
                <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50">
                  <div className="text-3xl sm:text-4xl font-extrabold text-primary">80%</div>
                  <div className="text-xs text-slate-400 mt-1 font-medium">Reduction in Booking Calls</div>
                </div>
                <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50">
                  <div className="text-3xl sm:text-4xl font-extrabold text-primary">2–4 hrs</div>
                  <div className="text-xs text-slate-400 mt-1 font-medium">Saved Daily per Staff</div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 bg-slate-800/40 border border-slate-700/30 rounded-2xl p-6 sm:p-8">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" /> Key Performance Improvements
              </h3>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  "Reduce appointment booking calls by up to 80%",
                  "Save 2–4 staff hours every day",
                  "Allow patients to book 24/7",
                  "Reduce missed appointments",
                  "Improve clinic efficiency",
                  "Manage clinic operations from a single dashboard"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-300 leading-normal">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 font-display">Everything You Need To Run Your Clinic</h2>
            <p className="text-base text-slate-600">
              One software suite replaces multiple fragmented tools. Scale seamlessly with full integration.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {[
              { title: "Online Appointment Booking", desc: "Interactive client booking" },
              { title: "AI Patient Receptionist", desc: "Automated chat coordinator" },
              { title: "Patient Management", desc: "Secure clinical history logging" },
              { title: "Digital Prescriptions", desc: "Format & issue script files" },
              { title: "Google Calendar Sync", desc: "Real-time calendar updates" },
              { title: "Subscription Management", desc: "Integrated payment gateways" },
              { title: "Clinic Dashboard", desc: "Aggregated metrics overview" },
              { title: "Appointment Tracking", desc: "Real-time scheduling status" },
              { title: "Automated Scheduling", desc: "Optimized slot selection" },
              { title: "Multi-Clinic Ready Architecture", desc: "Manage multi-franchise groups" }
            ].map((feature, idx) => (
              <div key={idx} className="bg-white border border-slate-100 rounded-xl p-5 hover:shadow-sm hover:border-primary/20 transition-all duration-200 flex flex-col justify-between space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="font-semibold text-slate-800 text-sm leading-tight">{feature.title}</h4>
                </div>
                <p className="text-xs text-slate-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Call to Action */}
        <section className="bg-gradient-to-br from-primary/5 to-blue-50/50 rounded-3xl p-8 sm:p-16 border border-primary/10 shadow-sm text-center space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-36 h-36 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />
          
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-display">Ready To Modernize Your Clinic?</h2>
          <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto leading-relaxed">
            Join clinics using ClinicFlow to automate bookings and manage operations more efficiently.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Button onClick={() => setOpen(true)} size="lg" className="h-12 px-8 text-base font-semibold shadow-md gap-2 w-full sm:w-auto">
              Register Your Clinic <ArrowRight className="w-4 h-4" />
            </Button>
            <Button onClick={() => setOpenDemo(true)} variant="outline" size="lg" className="h-12 px-8 text-slate-700 border-slate-200 hover:bg-slate-50 font-semibold w-full sm:w-auto">
              Book Free Demo
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full bg-white border-t border-slate-100 py-8 mt-16 relative z-10">
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
