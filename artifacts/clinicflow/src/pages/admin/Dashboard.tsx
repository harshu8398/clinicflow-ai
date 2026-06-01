import { useParams } from "wouter";
import { useGetDashboard, useUpdateAppointmentStatus, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, CalendarCheck, Clock, CheckCircle2, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { clinicId } = useParams();
  const id = Number(clinicId);
  const { data: stats, isLoading } = useGetDashboard(id);
  const updateStatus = useUpdateAppointmentStatus();
  const queryClient = useQueryClient();

  const handleStatusChange = (appointmentId: number, status: 'pending' | 'confirmed' | 'completed') => {
    updateStatus.mutate(
      { clinicId: id, appointmentId, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey(id) });
        }
      }
    );
  };

  const statusColors = {
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    confirmed: "bg-primary/10 text-primary border-primary/20",
    completed: "bg-green-100 text-green-800 border-green-200",
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-gray-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">Total</p>
            <h3 className="text-3xl font-bold text-gray-900">{stats.totalAppointments}</h3>
          </CardContent>
        </Card>
        
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">Today</p>
            <h3 className="text-3xl font-bold text-gray-900">{stats.todayAppointments}</h3>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">Pending</p>
            <h3 className="text-3xl font-bold text-gray-900">{stats.pendingCount}</h3>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CalendarCheck className="w-5 h-5 text-primary" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">Confirmed</p>
            <h3 className="text-3xl font-bold text-gray-900">{stats.confirmedCount}</h3>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">Completed</p>
            <h3 className="text-3xl font-bold text-gray-900">{stats.completedCount}</h3>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-gray-100 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-gray-50 bg-gray-50/50">
          <CardTitle className="text-lg font-semibold text-gray-900">Recent Appointments</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/30 hover:bg-gray-50/30">
                <TableHead className="font-medium text-gray-500">Patient</TableHead>
                <TableHead className="font-medium text-gray-500">Date & Time</TableHead>
                <TableHead className="font-medium text-gray-500">Problem</TableHead>
                <TableHead className="font-medium text-gray-500">Phone</TableHead>
                <TableHead className="font-medium text-gray-500">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.recentAppointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-gray-500">
                    No recent appointments
                  </TableCell>
                </TableRow>
              ) : (
                stats.recentAppointments.map((apt) => (
                  <TableRow key={apt.id} className="hover:bg-gray-50/50 transition-colors">
                    <TableCell className="font-medium text-gray-900">{apt.patientName}</TableCell>
                    <TableCell className="text-gray-600">
                      {(() => { const d = new Date(apt.appointmentDate); return isNaN(d.getTime()) ? apt.appointmentDate : format(d, "MMM d, yyyy"); })()}
                    </TableCell>
                    <TableCell className="text-gray-600 max-w-[200px] truncate" title={apt.patientProblem}>
                      {apt.patientProblem}
                    </TableCell>
                    <TableCell className="text-gray-600">{apt.patientPhone}</TableCell>
                    <TableCell>
                      <Select 
                        value={apt.status} 
                        onValueChange={(val: any) => handleStatusChange(apt.id, val)}
                        disabled={updateStatus.isPending}
                      >
                        <SelectTrigger className={`w-32 h-8 border shadow-none ${statusColors[apt.status]}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
