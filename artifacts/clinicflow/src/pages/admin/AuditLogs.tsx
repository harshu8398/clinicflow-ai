import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, Search, FileClock, Calendar, User, Info } from "lucide-react";

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/subscriptions/audit-logs`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(
    (log) =>
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.userEmail && log.userEmail.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Audit Logs</h2>
          <p className="text-gray-500 mt-1 text-sm">Monitor platform-wide administrative actions, system events, and impersonation logs.</p>
        </div>
        <Button variant="outline" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Search Filter */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by action, email, or details..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="min-h-[300px] flex items-center justify-center bg-white border border-gray-100 rounded-xl shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <Card className="p-16 text-center border-dashed">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileClock className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No logs found</h3>
          <p className="text-gray-500">
            {searchQuery ? "Try refining your search query." : "No platform actions have been recorded yet."}
          </p>
        </Card>
      ) : (
        <Card className="bg-white border-gray-100 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="w-[180px] font-semibold text-slate-700">Timestamp</TableHead>
                    <TableHead className="w-[180px] font-semibold text-slate-700">User Email</TableHead>
                    <TableHead className="w-[200px] font-semibold text-slate-700">Action</TableHead>
                    <TableHead className="font-semibold text-slate-700">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-gray-50/30">
                      <TableCell className="text-slate-600 text-sm whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {new Date(log.createdAt).toLocaleString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-700 text-sm">
                        <span className="flex items-center gap-1.5 font-medium">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {log.userEmail || `User ID: ${log.userId}`}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-900 text-sm font-semibold">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/5 text-primary border border-primary/10">
                          {log.action}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        <span className="flex items-start gap-1.5">
                          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span>{log.details || "N/A"}</span>
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
