import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Hospital, Sparkles, AlertTriangle, ShieldCheck, FileClock, History, Loader2, ArrowRight } from "lucide-react";
import { Link } from "wouter";

export default function PlatformOverview() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/subscriptions/overview`,
          { credentials: "include" }
        );
        if (res.ok) {
          const stats = await res.json();
          setData(stats);
        }
      } catch (err) {
        console.error("Failed to load platform overview:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 font-sans">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 font-display">Platform Overview</h2>
          <p className="text-slate-500 text-xs mt-1">Real-time platform statistics, request statuses, and system activity logs.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card className="bg-white border-slate-100 hover:border-slate-200 transition-all duration-300 rounded-xl overflow-hidden shadow-xs hover:shadow-md relative pl-2 select-none">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-slate-300" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 text-slate-500 flex items-center justify-center">
                <Hospital className="w-4.5 h-4.5" />
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-400 mb-0.5">Total Clinics</p>
            <h3 className="text-2xl font-extrabold text-slate-800 font-display">{data.totalClinics}</h3>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-100 hover:border-slate-200 transition-all duration-300 rounded-xl overflow-hidden shadow-xs hover:shadow-md relative pl-2 select-none">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-green-500" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-green-50 border border-green-100 text-green-600 flex items-center justify-center">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-400 mb-0.5">Active</p>
            <h3 className="text-2xl font-extrabold text-slate-800 font-display">{data.activeSubscriptions}</h3>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-100 hover:border-slate-200 transition-all duration-300 rounded-xl overflow-hidden shadow-xs hover:shadow-md relative pl-2 select-none">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-100 text-red-500 flex items-center justify-center">
                <AlertTriangle className="w-4.5 h-4.5" />
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-400 mb-0.5">Expired</p>
            <h3 className="text-2xl font-extrabold text-slate-800 font-display">{data.expiredSubscriptions}</h3>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-100 hover:border-slate-200 transition-all duration-300 rounded-xl overflow-hidden shadow-xs hover:shadow-md relative pl-2 select-none">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 text-blue-500 flex items-center justify-center">
                <ClockIcon className="w-4.5 h-4.5" />
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-400 mb-0.5">Trial Period</p>
            <h3 className="text-2xl font-extrabold text-slate-800 font-display">{data.trialClinics}</h3>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-100 hover:border-slate-200 transition-all duration-300 rounded-xl overflow-hidden shadow-xs hover:shadow-md relative pl-2 select-none">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-500" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center">
                <Sparkles className="w-4.5 h-4.5" />
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-400 mb-0.5">Lifetime</p>
            <h3 className="text-2xl font-extrabold text-slate-800 font-display">{data.lifetimeClinics}</h3>
          </CardContent>
        </Card>

        <Card className="bg-amber-50/15 border-amber-100 hover:border-amber-200 transition-all duration-300 rounded-xl overflow-hidden shadow-xs hover:shadow-md relative pl-2 select-none">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
                <FileClock className="w-4.5 h-4.5" />
              </div>
            </div>
            <p className="text-xs font-semibold text-amber-600 mb-0.5">Pending</p>
            <h3 className="text-2xl font-extrabold text-amber-950 font-display">{data.pendingCount}</h3>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Recent Requests */}
        <Card className="bg-white border-slate-100 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-slate-50 bg-slate-50/50 flex flex-row items-center justify-between py-4 px-6">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800 font-display">Recent Payment Proofs</CardTitle>
              <CardDescription className="text-[11px] text-slate-400 mt-0.5">Awaiting verification or recently verified.</CardDescription>
            </div>
            <Link href="/subscription-requests">
              <div className="text-xs text-primary hover:text-primary-hover font-semibold flex items-center gap-1 cursor-pointer transition-colors">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/30">
                  <TableHead className="text-xs font-semibold text-slate-500 py-3">Clinic</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 py-3">Plan</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 py-3">Amount</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 py-3">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-slate-400 text-xs py-8">
                      No recent requests submitted
                    </TableCell>
                  </TableRow>
                ) : (
                  data.recentRequests.map((req: any) => (
                    <TableRow key={req.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-semibold text-slate-800 py-3.5">{req.clinicName}</TableCell>
                      <TableCell className="uppercase text-slate-500 font-medium py-3.5">{req.planType}</TableCell>
                      <TableCell className="font-bold text-slate-800 py-3.5">₹{req.amount}</TableCell>
                      <TableCell className="py-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            req.status === "Approved"
                              ? "bg-green-50 text-green-700 border-green-100"
                              : req.status === "Rejected"
                              ? "bg-red-50 text-red-700 border-red-100"
                              : "bg-amber-50 text-amber-700 border-amber-100"
                          }`}
                        >
                          {req.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Right Column: Recent Audit Logs */}
        <Card className="bg-white border-slate-100 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-slate-50 bg-slate-50/50 flex flex-row items-center justify-between py-4 px-6">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800 font-display">Recent Audit Logs</CardTitle>
              <CardDescription className="text-[11px] text-slate-400 mt-0.5">Platform-wide changes and actions.</CardDescription>
            </div>
            <Link href="/audit-logs">
              <div className="text-xs text-primary hover:text-primary-hover font-semibold flex items-center gap-1 cursor-pointer transition-colors">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/30">
                  <TableHead className="text-xs font-semibold text-slate-500 py-3">Date</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 py-3">Action</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 py-3">User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-32 text-center text-slate-400 text-xs py-8">
                      No audit log entries
                    </TableCell>
                  </TableRow>
                ) : (
                  data.recentLogs.map((log: any) => (
                    <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="text-slate-400 py-3.5">
                        {new Date(log.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-800 py-3.5" title={log.details}>
                        {log.action}
                      </TableCell>
                      <TableCell className="text-slate-500 font-medium py-3.5">{log.userEmail}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}

// Clock Icon Helper
function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
