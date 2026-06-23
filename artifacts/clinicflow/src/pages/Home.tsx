import { useState } from "react";
import { useLocation } from "wouter";
import { useListClinics, useCreateClinic, getListClinicsQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowRight, Loader2, Hospital } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: clinics, isLoading } = useListClinics();
  const createClinic = useCreateClinic();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    address: "",
    fee: "",
    timings: ""
  });

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
        queryClient.invalidateQueries({ queryKey: getListClinicsQueryKey() });
        handleClinicSelect(newClinic.id);
      },
      onError: () => {
        toast({ title: "Failed to create clinic", variant: "destructive" });
      }
    });
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
              Admin Portal
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="shadow-sm shadow-primary/10">Register Clinic</Button>
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
      <main className="max-w-6xl w-full mx-auto px-6 pt-16 flex-1 flex flex-col space-y-16 relative z-10">
        
        {/* Hero Section */}
        <section className="text-center max-w-3xl mx-auto space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-semibold uppercase tracking-wider mb-2 animate-fade-in">
            🚀 Launching Patient Receptionist
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-none font-display">
            Manage Patients, Appointments <br/>
            <span className="bg-gradient-to-r from-primary to-primary bg-clip-text text-transparent">& Clinic Operations</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-xl mx-auto font-normal">
            ClinicFlow helps clinics manage appointments, patient records, prescriptions, billing, and daily operations from a single dashboard.
          </p>
        </section>

        {/* Clinics Listing Section */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-end border-b border-slate-100 pb-5 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 font-display">Select a Clinic</h2>
              <p className="text-sm text-slate-500 mt-1">Select one of our registered clinics below to test their live patient receptionist chatbot.</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-widest bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200/50">
              <Hospital className="w-3.5 h-3.5" />
              Active System Clinics
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse border-slate-100 bg-white shadow-sm rounded-2xl h-44" />
              ))}
            </div>
          ) : clinics?.length === 0 ? (
            <Card className="flex flex-col items-center justify-center p-16 text-center border-dashed border-2 border-slate-200 bg-white/50 rounded-2xl">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-400">
                <Hospital className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 font-display">No clinics registered</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-xs mx-auto">Get started by creating your very first clinic receptionist portal using the register option.</p>
              <Button onClick={() => setOpen(true)} className="mt-6 shadow-sm">Register Clinic Now</Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clinics?.map(clinic => (
                <Card 
                  key={clinic.id} 
                  className="group cursor-pointer border-slate-100 bg-white hover:border-primary hover:shadow-lg transition-all duration-300 rounded-2xl flex flex-col justify-between overflow-hidden shadow-sm relative"
                  onClick={() => handleClinicSelect(clinic.id)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-lg font-bold text-slate-800 font-display">
                      <span className="truncate group-hover:text-primary transition-colors">{clinic.name}</span>
                      <div className="w-8 h-8 rounded-lg bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white flex items-center justify-center transition-all duration-300">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400 truncate mt-0.5">{clinic.address}</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-4 flex-1">
                    <div className="text-xs text-slate-600 space-y-2">
                      <div className="flex items-center justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-400">Consultation Fee</span>
                        <span className="font-semibold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                          {clinic.fee}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-400">Working Hours</span>
                        <span className="font-semibold text-slate-800 truncate max-w-[150px]">{clinic.timings}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
