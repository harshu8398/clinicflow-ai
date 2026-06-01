import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useGetClinic, useUpdateClinic, getGetClinicQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Save } from "lucide-react";

export default function Settings() {
  const { clinicId } = useParams();
  const id = Number(clinicId);
  const { data: clinic, isLoading } = useGetClinic(id);
  const updateClinic = useUpdateClinic();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    address: "",
    fee: "",
    timings: ""
  });

  useEffect(() => {
    if (clinic) {
      setFormData({
        name: clinic.name,
        email: clinic.email,
        address: clinic.address,
        fee: clinic.fee,
        timings: clinic.timings
      });
    }
  }, [clinic]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateClinic.mutate({ clinicId: id, data: formData }, {
      onSuccess: () => {
        toast({ title: "Settings updated successfully" });
        queryClient.invalidateQueries({ queryKey: getGetClinicQueryKey(id) });
      },
      onError: () => {
        toast({ title: "Failed to update settings", variant: "destructive" });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl">
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl animate-in fade-in duration-500">
      <form onSubmit={handleSubmit}>
        <Card className="bg-white border-gray-100 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-gray-50 bg-gray-50/50">
            <CardTitle>Clinic Profile</CardTitle>
            <CardDescription>Update your clinic's public information and settings.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Clinic Name</Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  className="bg-gray-50/50 focus-visible:bg-white"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Contact Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={formData.email} 
                  onChange={e => setFormData({ ...formData, email: e.target.value })} 
                  className="bg-gray-50/50 focus-visible:bg-white"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Address</Label>
                <Input 
                  id="address" 
                  value={formData.address} 
                  onChange={e => setFormData({ ...formData, address: e.target.value })} 
                  className="bg-gray-50/50 focus-visible:bg-white"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fee">Consultation Fee</Label>
                <Input 
                  id="fee" 
                  value={formData.fee} 
                  onChange={e => setFormData({ ...formData, fee: e.target.value })} 
                  className="bg-gray-50/50 focus-visible:bg-white"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="timings">Operating Timings</Label>
                <Input 
                  id="timings" 
                  value={formData.timings} 
                  onChange={e => setFormData({ ...formData, timings: e.target.value })} 
                  className="bg-gray-50/50 focus-visible:bg-white"
                />
              </div>
            </div>
            
            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <Button type="submit" disabled={updateClinic.isPending} className="w-full sm:w-auto">
                {updateClinic.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
