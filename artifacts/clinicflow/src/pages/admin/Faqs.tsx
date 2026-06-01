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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Knowledge Base</h2>
          <p className="text-gray-500 mt-1 text-sm">Train the chat bot on common patient queries.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add FAQ</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New FAQ</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="question">Question</Label>
                <Input 
                  id="question" 
                  required 
                  value={formData.question} 
                  onChange={e => setFormData({ ...formData, question: e.target.value })} 
                  placeholder="e.g. Do you accept insurance?"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="answer">Answer</Label>
                <Textarea 
                  id="answer" 
                  required 
                  value={formData.answer} 
                  onChange={e => setFormData({ ...formData, answer: e.target.value })} 
                  placeholder="Provide a clear, concise answer..."
                  rows={4}
                />
              </div>
              <Button type="submit" className="w-full" disabled={createFaq.isPending}>
                {createFaq.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save FAQ
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : faqs?.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-16 text-center border-dashed">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <HelpCircle className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No FAQs yet</h3>
          <p className="text-gray-500 mb-6">Add frequently asked questions so the bot can answer them automatically.</p>
          <Button variant="outline" onClick={() => setOpen(true)}>Add your first FAQ</Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {faqs?.map((faq) => (
            <Card key={faq.id} className="bg-white border-gray-100 shadow-sm hover:border-primary/20 transition-colors group">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-1">
                    <span className="font-semibold text-sm">Q</span>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-start">
                      <h4 className="font-medium text-gray-900 text-lg leading-snug">{faq.question}</h4>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-gray-300 hover:text-red-600 hover:bg-red-50 -mt-2 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDelete(faq.id)}
                        disabled={deleteFaq.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1 text-gray-600 leading-relaxed bg-gray-50/50 p-4 rounded-lg">
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
