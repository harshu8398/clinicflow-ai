import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { 
  Mail, 
  Loader2, 
  RefreshCw, 
  Search, 
  Trash2, 
  Eye, 
  Check, 
  Calendar,
  MessageSquare,
  MailOpen
} from "lucide-react";

interface ContactMessage {
  id: number;
  name: string;
  email: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function ContactMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all"); // 'all', 'unread', 'read'
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [actionPending, setActionPending] = useState<number | null>(null);
  const { toast } = useToast();

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/contact-messages`, {
        credentials: "include"
      });
      
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      } else {
        throw new Error("Failed to load contact messages.");
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error loading messages",
        description: err.message || "Failed to retrieve contact messages.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleMarkRead = async (messageId: number) => {
    setActionPending(messageId);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/contact-messages/${messageId}/read`, {
        method: "PATCH",
        credentials: "include"
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update message status");
      }

      toast({
        title: "Message Updated",
        description: "Message successfully marked as read."
      });
      
      if (selectedMessage && selectedMessage.id === messageId) {
        setSelectedMessage({ ...selectedMessage, isRead: true });
      }

      fetchMessages();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Update Failed",
        description: err.message || "Failed to update message status.",
        variant: "destructive"
      });
    } finally {
      setActionPending(null);
    }
  };

  const handleDelete = async (messageId: number) => {
    if (!confirm("Are you sure you want to delete this message?")) return;
    
    setActionPending(messageId);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/contact-messages/${messageId}`, {
        method: "DELETE",
        credentials: "include"
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete message");
      }

      toast({
        title: "Message Deleted",
        description: "Message was successfully deleted from the database."
      });
      
      if (selectedMessage && selectedMessage.id === messageId) {
        setSelectedMessage(null);
      }

      fetchMessages();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Delete Failed",
        description: err.message || "Failed to delete contact message.",
        variant: "destructive"
      });
    } finally {
      setActionPending(null);
    }
  };

  // Handle opening view dialog & marking as read automatically if unread
  const handleViewMessage = (message: ContactMessage) => {
    setSelectedMessage(message);
    if (!message.isRead) {
      handleMarkRead(message.id);
    }
  };

  // Compute counters
  const totalCount = messages.length;
  const unreadCount = messages.filter(m => !m.isRead).length;
  const readCount = messages.filter(m => m.isRead).length;

  // Filter & search
  const filteredMessages = messages.filter((msg) => {
    // 1. Status Filter
    if (filter === "unread" && msg.isRead) return false;
    if (filter === "read" && !msg.isRead) return false;

    // 2. Search query
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim();
      return (
        msg.name.toLowerCase().includes(query) ||
        msg.email.toLowerCase().includes(query) ||
        msg.message.toLowerCase().includes(query)
      );
    }

    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 font-display tracking-tight">Contact Messages</h2>
          <p className="text-xs text-slate-400 mt-1">Manage feedback, inquiries, and support messages sent via the Contact Us form.</p>
        </div>
        <Button variant="outline" onClick={fetchMessages} className="h-10 border-slate-200 hover:bg-slate-50 font-semibold text-xs px-4 cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5 mr-2" /> Refresh
        </Button>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white border-slate-100 shadow-sm rounded-xl">
          <CardContent className="p-4 text-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Messages</span>
            <span className="font-extrabold text-2xl text-slate-800 mt-1 block font-display">{totalCount}</span>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-100 shadow-sm rounded-xl">
          <CardContent className="p-4 text-center">
            <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider block">Unread Messages</span>
            <span className="font-extrabold text-2xl text-amber-600 mt-1 block font-display">{unreadCount}</span>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-100 shadow-sm rounded-xl">
          <CardContent className="p-4 text-center">
            <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider block">Read Messages</span>
            <span className="font-extrabold text-2xl text-emerald-600 mt-1 block font-display">{readCount}</span>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <Card className="bg-white border-slate-100 shadow-sm rounded-xl">
        <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 w-full relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <Input
              placeholder="Search by Name, Email, or Message Content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-lg border-slate-200"
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-full md:w-44">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 text-xs px-3 font-semibold text-slate-700 bg-white"
              >
                <option value="all">All Messages</option>
                <option value="unread">Unread Only</option>
                <option value="read">Read Only</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages Table */}
      {loading ? (
        <div className="min-h-[300px] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredMessages.length === 0 ? (
        <Card className="p-16 text-center border-dashed border-slate-200 rounded-xl">
          <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-6 h-6 text-slate-350" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 font-display mb-1">No messages found</h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            Try adjusting your search query or switching filters to see submissions.
          </p>
        </Card>
      ) : (
        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Sender Details</th>
                  <th className="py-3.5 px-6">Message Snippet</th>
                  <th className="py-3.5 px-6">Submitted Date</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {filteredMessages.map((msg) => (
                  <tr key={msg.id} className={`hover:bg-slate-50/40 transition-colors ${!msg.isRead ? 'font-semibold bg-amber-50/10' : ''}`}>
                    <td className="py-4 px-6 shrink-0">
                      {!msg.isRead ? (
                        <span className="px-2 py-0.5 border border-amber-200 bg-amber-50 text-amber-700 rounded-full text-[9px] font-bold uppercase tracking-wider">
                          New
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 border border-slate-200 bg-slate-50 text-slate-500 rounded-full text-[9px] font-bold uppercase tracking-wider">
                          Read
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-800">{msg.name}</div>
                      <div className="text-slate-450 text-[11px] font-medium flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3" /> {msg.email}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-600 max-w-xs truncate">
                      {msg.message}
                    </td>
                    <td className="py-4 px-6 text-slate-400 font-medium whitespace-nowrap">
                      {new Date(msg.createdAt).toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-right space-x-1 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewMessage(msg)}
                        disabled={actionPending === msg.id}
                        className="h-8 w-8 p-0 text-primary hover:bg-primary/5 cursor-pointer rounded-lg inline-flex items-center justify-center"
                        title="View Full Message"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {!msg.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkRead(msg.id)}
                          disabled={actionPending === msg.id}
                          className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50 cursor-pointer rounded-lg inline-flex items-center justify-center"
                          title="Mark as Read"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(msg.id)}
                        disabled={actionPending === msg.id}
                        className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 cursor-pointer rounded-lg inline-flex items-center justify-center"
                        title="Delete Message"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Details View Dialog */}
      <Dialog open={selectedMessage !== null} onOpenChange={(open) => !open && setSelectedMessage(null)}>
        <DialogContent className="sm:max-w-lg rounded-2xl p-6">
          {selectedMessage && (
            <div className="space-y-5">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold font-display text-slate-800 flex items-center gap-2">
                  {selectedMessage.isRead ? <MailOpen className="w-5 h-5 text-primary" /> : <Mail className="w-5 h-5 text-amber-500" />} 
                  Contact Message
                </DialogTitle>
              </DialogHeader>

              <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Sender Name</span>
                  <span className="font-bold text-slate-800 mt-1 block">{selectedMessage.name}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Sender Email</span>
                  <a href={`mailto:${selectedMessage.email}`} className="font-semibold text-primary hover:underline mt-1 block flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" /> {selectedMessage.email}
                  </a>
                </div>
                <div className="col-span-2">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Submitted Date</span>
                  <span className="font-medium text-slate-500 mt-1 block flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> {new Date(selectedMessage.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="col-span-2 border-t border-slate-50 pt-3">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Message Content</span>
                  <div className="mt-2 bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs text-slate-700 leading-relaxed min-h-[100px] whitespace-pre-wrap">
                    {selectedMessage.message}
                  </div>
                </div>
              </div>

              {/* Dialog Actions */}
              <div className="border-t border-slate-100 pt-4 flex justify-between items-center gap-2">
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(selectedMessage.id)}
                  disabled={actionPending !== null}
                  className="h-9 px-4 font-semibold text-xs rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Message
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedMessage(null)}
                  className="h-9 px-4 font-semibold text-xs border-slate-200 hover:bg-slate-50 cursor-pointer rounded-lg"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
