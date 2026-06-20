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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Platform Overview</h2>
        <p className="text-gray-500 mt-1 text-sm">Real-time platform statistics, request statuses, and system activity logs.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <Hospital className="w-5 h-5 text-gray-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">Total Clinics</p>
            <h3 className="text-2xl font-bold text-gray-900">{data.totalClinics}</h3>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">Active</p>
            <h3 className="text-2xl font-bold text-gray-900">{data.activeSubscriptions}</h3>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">Expired</p>
            <h3 className="text-2xl font-bold text-gray-900">{data.expiredSubscriptions}</h3>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <ClockIcon className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">Trial Period</p>
            <h3 className="text-2xl font-bold text-gray-900">{data.trialClinics}</h3>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">Lifetime</p>
            <h3 className="text-2xl font-bold text-gray-900">{data.lifetimeClinics}</h3>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-100 shadow-sm border-amber-200 bg-amber-50/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <FileClock className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-amber-600 mb-1">Pending verification</p>
            <h3 className="text-2xl font-bold text-amber-900">{data.pendingCount}</h3>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Recent Requests */}
        <Card className="bg-white border-gray-100 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-gray-50 bg-gray-50/50 flex flex-row items-center justify-between py-4 px-6">
            <div>
              <CardTitle className="text-base font-bold text-gray-900">Recent Payment Proofs</CardTitle>
              <CardDescription className="text-xs">Awaiting verification or recently verified.</CardDescription>
            </div>
            <Link href="/subscription-requests">
              <div className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/30">
                  <TableHead className="text-xs">Clinic</TableHead>
                  <TableHead className="text-xs">Plan</TableHead>
                  <TableHead className="text-xs">Amount</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-gray-400 text-xs">
                      No recent requests submitted
                    </TableCell>
                  </TableRow>
                ) : (
                  data.recentRequests.map((req: any) => (
                    <TableRow key={req.id} className="hover:bg-gray-50/50 text-xs">
                      <TableCell className="font-semibold text-slate-800">{req.clinicName}</TableCell>
                      <TableCell className="uppercase text-slate-600">{req.planType}</TableCell>
                      <TableCell className="font-semibold text-slate-800">₹{req.amount}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
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
        <Card className="bg-white border-gray-100 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-gray-50 bg-gray-50/50 flex flex-row items-center justify-between py-4 px-6">
            <div>
              <CardTitle className="text-base font-bold text-gray-900">Recent Audit Logs</CardTitle>
              <CardDescription className="text-xs">Platform-wide changes and actions.</CardDescription>
            </div>
            <Link href="/audit-logs">
              <div className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/30">
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Action</TableHead>
                  <TableHead className="text-xs">User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-32 text-center text-gray-400 text-xs">
                      No audit log entries
                    </TableCell>
                  </TableRow>
                ) : (
                  data.recentLogs.map((log: any) => (
                    <TableRow key={log.id} className="hover:bg-gray-50/50 text-xs">
                      <TableCell className="text-slate-500">
                        {new Date(log.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-800" title={log.details}>
                        {log.action}
                      </TableCell>
                      <TableCell className="text-slate-600">{log.userEmail}</TableCell>
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
