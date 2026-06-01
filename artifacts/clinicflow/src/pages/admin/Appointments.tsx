import { useState } from "react";
import { useParams } from "wouter";
import { useListAppointments, useUpdateAppointmentStatus, useDeleteAppointment, getListAppointmentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { CalendarX2, Trash2 } from "lucide-react";

export default function Appointments() {
  const { clinicId } = useParams();
  const id = Number(clinicId);
  const { data: appointments, isLoading } = useListAppointments(id);
  const updateStatus = useUpdateAppointmentStatus();
  const deleteAppointment = useDeleteAppointment();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("all");

  const handleStatusChange = (appointmentId: number, status: 'pending' | 'confirmed' | 'completed') => {
    updateStatus.mutate(
      { clinicId: id, appointmentId, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey(id) });
        }
      }
    );
  };

  const handleDelete = (appointmentId: number) => {
    if (confirm("Are you sure you want to delete this appointment?")) {
      deleteAppointment.mutate(
        { clinicId: id, appointmentId },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey(id) });
          }
        }
      );
    }
  };

  const statusColors = {
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    confirmed: "bg-primary/10 text-primary border-primary/20",
    completed: "bg-green-100 text-green-800 border-green-200",
  };

  const filteredAppointments = appointments?.filter(apt => filter === "all" || apt.status === filter) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card className="bg-white border-gray-100 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-gray-50 bg-gray-50/50 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">All Appointments</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Filter by status:</span>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <CalendarX2 className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No appointments found</h3>
            <p className="text-gray-500">There are no appointments matching your filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/30 hover:bg-gray-50/30">
                  <TableHead className="font-medium text-gray-500">Patient</TableHead>
                  <TableHead className="font-medium text-gray-500">Date & Time</TableHead>
                  <TableHead className="font-medium text-gray-500 w-[250px]">Problem</TableHead>
                  <TableHead className="font-medium text-gray-500">Phone</TableHead>
                  <TableHead className="font-medium text-gray-500">Status</TableHead>
                  <TableHead className="font-medium text-gray-500 w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments.map((apt) => (
                  <TableRow key={apt.id} className="hover:bg-gray-50/50 transition-colors">
                    <TableCell className="font-medium text-gray-900">{apt.patientName}</TableCell>
                    <TableCell className="text-gray-600">
                      {format(new Date(apt.appointmentDate || apt.createdAt), "MMM d, yyyy • h:mm a")}
                    </TableCell>
                    <TableCell className="text-gray-600 truncate max-w-[250px]" title={apt.patientProblem}>
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
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(apt.id)}
                        disabled={deleteAppointment.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
