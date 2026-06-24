import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Users, 
  Calendar, 
  Loader2, 
  RefreshCw, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  CheckSquare, 
  TrendingUp, 
  Check, 
  X,
  ClipboardList
} from "lucide-react";

interface Lead {
  id: number;
  fullName: string;
  clinicName: string;
  mobileNumber: string;
  email: string;
  city: string;
  notes: string | null;
  status: string;
  createdAt: string;
}

interface Stats {
  total: number;
  newCount: number;
  contactedCount: number;
  scheduledCount: number;
  convertedCount: number;
  closedCount: number;
  conversionRate: number;
}

export default function DemoRequests() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    newCount: 0,
    contactedCount: 0,
    scheduledCount: 0,
    convertedCount: 0,
    closedCount: 0,
    conversionRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [actionPending, setActionPending] = useState<number | null>(null);
  const { toast } = useToast();

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      
      const res = await fetch(`${base}/api/demo-requests?${params.toString()}`, {
        credentials: "include"
      });
      
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
        setStats(data.stats || {
          total: 0,
          newCount: 0,
          contactedCount: 0,
          scheduledCount: 0,
          convertedCount: 0,
          closedCount: 0,
          conversionRate: 0
        });
      } else {
        throw new Error("Failed to load demo requests");
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error loading leads",
        description: err.message || "Failed to retrieve demo requests.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, toast]);

  useEffect(() => {
    fetchLeads();
  }, [statusFilter]); // trigger reload on status filter change immediately. For search, we can use a button or trigger on key press.

  const handleUpdateStatus = async (leadId: number, nextStatus: string) => {
    setActionPending(leadId);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/demo-requests/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
        credentials: "include"
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }

      toast({
        title: "Status Updated",
        description: `Lead updated to status: ${nextStatus}`
      });
      
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead({ ...selectedLead, status: nextStatus });
      }

      fetchLeads();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Update Failed",
        description: err.message || "Failed to update lead status.",
        variant: "destructive"
      });
    } finally {
      setActionPending(null);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const classes: Record<string, string> = {
      New: "bg-slate-50 text-slate-700 border-slate-200",
      Contacted: "bg-blue-50 text-blue-700 border-blue-200",
      "Demo Scheduled": "bg-amber-50 text-amber-700 border-amber-200",
      Converted: "bg-emerald-50 text-emerald-700 border-emerald-200",
      Closed: "bg-rose-50 text-rose-700 border-rose-200"
    };
    return classes[status] || "bg-slate-50 border-slate-100 text-slate-500";
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 font-display tracking-tight">Demo Request Leads</h2>
          <p className="text-xs text-slate-400 mt-1">Track and manage doctors who requested a demo walkthrough for ClinicFlow.</p>
        </div>
        <Button variant="outline" onClick={fetchLeads} className="h-10 border-slate-200 hover:bg-slate-50 font-semibold text-xs px-4 cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5 mr-2" /> Refresh List
        </Button>
      </div>

      {/* Lead Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="bg-white border-slate-100 shadow-sm rounded-xl">
          <CardContent className="p-4 text-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Leads</span>
            <span className="font-extrabold text-2xl text-slate-800 mt-1 block font-display">{stats.total}</span>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-100 shadow-sm rounded-xl">
          <CardContent className="p-4 text-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">New Leads</span>
            <span className="font-extrabold text-2xl text-slate-650 mt-1 block font-display">{stats.newCount}</span>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-100 shadow-sm rounded-xl">
          <CardContent className="p-4 text-center">
            <span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider block">Contacted</span>
            <span className="font-extrabold text-2xl text-blue-600 mt-1 block font-display">{stats.contactedCount}</span>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-100 shadow-sm rounded-xl">
          <CardContent className="p-4 text-center">
            <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider block">Scheduled</span>
            <span className="font-extrabold text-2xl text-amber-600 mt-1 block font-display">{stats.scheduledCount}</span>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-100 shadow-sm rounded-xl">
          <CardContent className="p-4 text-center">
            <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider block">Converted</span>
            <span className="font-extrabold text-2xl text-emerald-600 mt-1 block font-display">{stats.convertedCount}</span>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-100 shadow-sm rounded-xl">
          <CardContent className="p-4 text-center">
            <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider block">Closed</span>
            <span className="font-extrabold text-2xl text-rose-600 mt-1 block font-display">{stats.closedCount}</span>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-0 text-white shadow-sm rounded-xl col-span-2 md:col-span-1 lg:col-span-1 flex items-center justify-center">
          <CardContent className="p-4 text-center">
            <span className="text-[9px] text-primary font-bold uppercase tracking-wider block flex items-center justify-center gap-1">
              <TrendingUp className="w-3 h-3" /> Conversion
            </span>
            <span className="font-extrabold text-2xl text-white mt-1 block font-display">{stats.conversionRate}%</span>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <Card className="bg-white border-slate-100 shadow-sm rounded-xl">
        <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 w-full relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <Input
              placeholder="Search by Name, Clinic, Mobile, or Email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchLeads()}
              className="pl-9 rounded-lg border-slate-200"
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-full md:w-44">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 text-xs px-3 font-semibold text-slate-700 bg-white"
              >
                <option value="all">All Statuses</option>
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Demo Scheduled">Demo Scheduled</option>
                <option value="Converted">Converted</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <Button onClick={fetchLeads} className="h-9 px-4 font-semibold text-xs rounded-lg cursor-pointer shrink-0">
              Apply Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      {loading ? (
        <div className="min-h-[300px] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : leads.length === 0 ? (
        <Card className="p-16 text-center border-dashed border-slate-200 rounded-xl">
          <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-6 h-6 text-slate-350" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 font-display mb-1">No matching leads found</h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            Try adjusting your search criteria or applying a different status filter to display results.
          </p>
        </Card>
      ) : (
        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Name</th>
                  <th className="py-3.5 px-6">Clinic Name</th>
                  <th className="py-3.5 px-6">Contact Info</th>
                  <th className="py-3.5 px-6">City</th>
                  <th className="py-3.5 px-6">Submitted Date</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-800">{lead.fullName}</td>
                    <td className="py-4 px-6 text-slate-650 font-medium">{lead.clinicName}</td>
                    <td className="py-4 px-6 space-y-1">
                      <div className="flex items-center text-slate-550 gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" /> {lead.mobileNumber}
                      </div>
                      <div className="flex items-center text-slate-550 gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" /> {lead.email}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-600 flex items-center gap-1 mt-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {lead.city}
                    </td>
                    <td className="py-4 px-6 text-slate-400 font-medium">
                      {new Date(lead.createdAt).toLocaleString()}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-0.5 border rounded-full text-[9px] font-bold uppercase tracking-wider ${getStatusBadgeClass(lead.status)}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right space-x-1.5 shrink-0 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLead(lead)}
                        className="h-7 text-[10px] font-bold text-primary hover:bg-primary/5 cursor-pointer rounded-md"
                      >
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Details View Modal */}
      <Dialog open={selectedLead !== null} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="sm:max-w-lg rounded-2xl p-6">
          {selectedLead && (
            <div className="space-y-5">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold font-display text-slate-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" /> Lead Details
                </DialogTitle>
              </DialogHeader>

              <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Full Name</span>
                  <span className="font-bold text-slate-800 mt-1 block">{selectedLead.fullName}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Clinic Name</span>
                  <span className="font-bold text-slate-800 mt-1 block">{selectedLead.clinicName}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Mobile Number</span>
                  <span className="font-semibold text-slate-700 mt-1 block flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {selectedLead.mobileNumber}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Email Address</span>
                  <span className="font-semibold text-slate-700 mt-1 block flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> {selectedLead.email}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">City</span>
                  <span className="font-semibold text-slate-700 mt-1 block flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> {selectedLead.city}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Submitted Date</span>
                  <span className="font-medium text-slate-500 mt-1 block flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> {new Date(selectedLead.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Notes</span>
                  <div className="mt-1 bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-xs text-slate-650 leading-relaxed min-h-[50px]">
                    {selectedLead.notes || <span className="text-slate-400 italic">No notes provided.</span>}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Current Status</span>
                  <span className={`inline-block mt-1 px-3 py-1 border rounded-full text-[9px] font-bold uppercase tracking-wider ${getStatusBadgeClass(selectedLead.status)}`}>
                    {selectedLead.status}
                  </span>
                </div>
              </div>

              {/* Status Update Actions */}
              <div className="border-t border-slate-100 pt-5 space-y-3">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Update Lead Lifecycle State</span>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    onClick={() => handleUpdateStatus(selectedLead.id, "Contacted")}
                    disabled={actionPending !== null || selectedLead.status === "Contacted"}
                    variant="outline"
                    className="h-8 text-[10px] font-bold border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 cursor-pointer rounded-lg px-3"
                  >
                    Mark Contacted
                  </Button>
                  <Button
                    onClick={() => handleUpdateStatus(selectedLead.id, "Demo Scheduled")}
                    disabled={actionPending !== null || selectedLead.status === "Demo Scheduled"}
                    variant="outline"
                    className="h-8 text-[10px] font-bold border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 cursor-pointer rounded-lg px-3"
                  >
                    Mark Demo Scheduled
                  </Button>
                  <Button
                    onClick={() => handleUpdateStatus(selectedLead.id, "Converted")}
                    disabled={actionPending !== null || selectedLead.status === "Converted"}
                    variant="outline"
                    className="h-8 text-[10px] font-bold border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 cursor-pointer rounded-lg px-3"
                  >
                    Mark Converted
                  </Button>
                  <Button
                    onClick={() => handleUpdateStatus(selectedLead.id, "Closed")}
                    disabled={actionPending !== null || selectedLead.status === "Closed"}
                    variant="destructive"
                    className="h-8 text-[10px] font-bold cursor-pointer rounded-lg px-3"
                  >
                    Mark Closed
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
