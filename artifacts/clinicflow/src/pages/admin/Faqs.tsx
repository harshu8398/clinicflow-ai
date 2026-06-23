import { useState } from "react";
import { useParams } from "wouter";
import { useListFaqs, useCreateFaq, useDeleteFaq, getListFaqsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, HelpCircle, Loader2 } from "lucide-react";

export default function Faqs() {
  const { clinicId } = useParams();
  const id = Number(clinicId);
  const { data: faqs, isLoading } = useListFaqs(id);
  const createFaq = useCreateFaq();
  const deleteFaq = useDeleteFaq();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ question: "", answer: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createFaq.mutate(
      { clinicId: id, data: formData },
      {
        onSuccess: () => {
          toast({ title: "FAQ added successfully" });
          setOpen(false);
          setFormData({ question: "", answer: "" });
          queryClient.invalidateQueries({ queryKey: getListFaqsQueryKey(id) });
        },
        onError: () => {
          toast({ title: "Failed to add FAQ", variant: "destructive" });
        }
      }
    );
  };

  const handleDelete = (faqId: number) => {
    if (confirm("Are you sure you want to delete this FAQ?")) {
      deleteFaq.mutate(
        { clinicId: id, faqId },
        {
          onSuccess: () => {
            toast({ title: "FAQ deleted" });
            queryClient.invalidateQueries({ queryKey: getListFaqsQueryKey(id) });
          }
        }
      );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 font-display tracking-tight">Knowledge Base</h2>
          <p className="text-xs text-slate-400 mt-1">Train the chatbot receptionist on common patient queries.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-10 text-xs font-bold px-4 rounded-xl shadow-sm cursor-pointer"><Plus className="w-4 h-4 mr-1.5" /> Add New FAQ</Button>
          </DialogTrigger>
          <DialogContent className="bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 max-w-md">
            <DialogHeader className="border-b border-slate-100/60 pb-3">
              <DialogTitle className="text-base font-bold text-slate-800 font-display">Add New FAQ</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4.5 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="question" className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Question</Label>
                <Input 
                  id="question" 
                  required 
                  value={formData.question} 
                  onChange={e => setFormData({ ...formData, question: e.target.value })} 
                  placeholder="e.g. Do you accept insurance?"
                  className="h-10 border-slate-200 text-xs focus-visible:bg-white bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="answer" className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Answer</Label>
                <Textarea 
                  id="answer" 
                  required 
                  value={formData.answer} 
                  onChange={e => setFormData({ ...formData, answer: e.target.value })} 
                  placeholder="Provide a clear, concise answer..."
                  rows={4}
                  className="border-slate-200 text-xs resize-none p-3 focus-visible:bg-white bg-white"
                />
              </div>
              <Button type="submit" className="w-full h-10.5 rounded-xl text-xs font-bold shadow-md shadow-primary/5 active:scale-[0.99] cursor-pointer" disabled={createFaq.isPending}>
                {createFaq.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Configuration
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl animate-pulse" />)}
        </div>
      ) : faqs?.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-16 text-center border-dashed border-slate-200 rounded-xl bg-white shadow-sm">
          <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <HelpCircle className="w-7 h-7 text-slate-350" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 font-display mb-1">No FAQs configured yet</h3>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed max-w-sm">Add frequently asked questions so the digital assistant can resolve queries automatically.</p>
          <Button variant="outline" onClick={() => setOpen(true)} className="h-9.5 text-xs font-bold border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer">Configure First FAQ</Button>
        </Card>
      ) : (
        <div className="grid gap-4.5">
          {faqs?.map((faq) => (
            <Card key={faq.id} className="bg-white border-slate-100 shadow-sm hover:border-primary/20 transition-all duration-200 rounded-xl overflow-hidden group">
              <CardContent className="p-5.5">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-xs font-display">
                    Q
                  </div>
                  <div className="flex-1 space-y-3.5">
                    <div className="flex justify-between items-start gap-4">
                      <h4 className="font-bold text-slate-800 text-base leading-snug font-display">{faq.question}</h4>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-slate-300 hover:text-rose-600 hover:bg-rose-50/50 h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-pointer"
                        onClick={() => handleDelete(faq.id)}
                        disabled={deleteFaq.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex">
                      <div className="flex-1 text-slate-650 text-xs leading-relaxed bg-slate-50/50 border border-slate-100/50 p-4 rounded-xl">
                        {faq.answer}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
