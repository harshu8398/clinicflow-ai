import { useState } from "react";
import { useLocation } from "wouter";
import { useListClinics, useCreateClinic, getListClinicsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, ArrowRight, Loader2, Hospital } from "lucide-react";
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
    address: "",
    fee: "",
    timings: ""
  });

  const handleClinicSelect = (clinicId: number) => {
    localStorage.setItem("selectedClinicId", clinicId.toString());
    setLocation(`/admin/${clinicId}`);
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
    <div className="min-h-screen bg-gray-50/50 flex flex-col items-center pt-24 px-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4">
            <Building2 className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">ClinicFlow AI</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Your 24x7 Digital Receptionist. Manage appointments, patient queries, and operations from a single dashboard.
          </p>
        </div>

        <div className="flex justify-between items-center mt-12">
          <h2 className="text-2xl font-semibold text-gray-900">Select Clinic</h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Register New Clinic</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register Clinic</DialogTitle>
              </DialogHeader>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Clinic Name</Label>
                  <Input id="name" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" required value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fee">Consultation Fee</Label>
                  <Input id="fee" required value={formData.fee} onChange={e => setFormData({ ...formData, fee: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timings">Timings</Label>
                  <Input id="timings" required value={formData.timings} onChange={e => setFormData({ ...formData, timings: e.target.value })} />
                </div>
                <Button type="submit" className="w-full" disabled={createClinic.isPending}>
                  {createClinic.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Register
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-32 bg-gray-100 rounded-t-xl" />
              </Card>
            ))}
          </div>
        ) : clinics?.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <Hospital className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-medium text-gray-900">No clinics registered</h3>
            <p className="text-gray-500 mt-2 mb-6">Create your first clinic to get started.</p>
            <Button onClick={() => setOpen(true)}>Register Clinic</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clinics?.map(clinic => (
              <Card 
                key={clinic.id} 
                className="group cursor-pointer hover:border-primary hover:shadow-md transition-all duration-200"
                onClick={() => handleClinicSelect(clinic.id)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {clinic.name}
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
                  </CardTitle>
                  <CardDescription>{clinic.address}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Fee: {clinic.fee}</p>
                    <p>Timings: {clinic.timings}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
