import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useStartChat, useSendChatMessage, ChatResponse } from "@workspace/api-client-react";
import { useGetClinic } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Hospital, Bot, User, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";

type Message = {
  id: string;
  type: "bot" | "patient";
  content: string;
};

export default function Chat() {
  const { clinicId } = useParams();
  const id = Number(clinicId);
  const { data: clinic } = useGetClinic(id);
  const startChat = useStartChat();
  const sendMessage = useSendChatMessage();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [session, setSession] = useState<{ id: string; step: string; isComplete: boolean; appointment?: any } | null>(null);
  const [context, setContext] = useState<any>({});
  const [isTyping, setIsTyping] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (id && !session) {
      setIsTyping(true);
      startChat.mutate({ clinicId: id }, {
        onSuccess: (res: ChatResponse) => {
          setTimeout(() => {
            setSession({ id: res.sessionId, step: res.step, isComplete: res.isComplete, appointment: res.appointment });
            setMessages([{ id: Date.now().toString(), type: "bot", content: res.botMessage }]);
            setIsTyping(false);
          }, 500);
        },
        onError: () => setIsTyping(false)
      });
    }
  }, [id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !session || session.isComplete || sendMessage.isPending) return;

    const patientMsg = inputValue.trim();
    setInputValue("");
    setMessages(prev => [...prev, { id: Date.now().toString(), type: "patient", content: patientMsg }]);
    
    // Simple context extraction logic based on steps
    let newContext = { ...context };
    if (session.step === "ask_name") newContext.patientName = patientMsg;
    else if (session.step === "ask_phone") newContext.patientPhone = patientMsg;
    else if (session.step === "ask_problem") newContext.patientProblem = patientMsg;
    else if (session.step === "ask_date") newContext.appointmentDate = patientMsg;

    setContext(newContext);
    setIsTyping(true);

    sendMessage.mutate({
      clinicId: id,
      data: {
        sessionId: session.id,
        step: session.step,
        message: patientMsg,
        context: newContext
      }
    }, {
      onSuccess: (res: ChatResponse) => {
        setTimeout(() => {
          setSession({ id: res.sessionId, step: res.step, isComplete: res.isComplete, appointment: res.appointment });
          setMessages(prev => [...prev, { id: Date.now().toString(), type: "bot", content: res.botMessage }]);
          setIsTyping(false);
        }, 500);
      },
      onError: () => setIsTyping(false)
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-8 px-4 pb-8">
      <div className="w-full max-w-2xl flex-1 flex flex-col bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-primary px-6 py-4 flex items-center justify-between shadow-sm z-10 relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Hospital className="text-white w-6 h-6" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg">{clinic?.name || "Clinic"} Reception</h2>
              <p className="text-primary-foreground/80 text-sm flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse"></span>
                Online | Replies instantly
              </p>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 p-6 relative">
          <div className="space-y-6">
            {messages.map((msg, i) => (
              <div key={msg.id} className={`flex ${msg.type === "patient" ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom-2 fade-in duration-300`}>
                <div className={`flex gap-3 max-w-[80%] ${msg.type === "patient" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.type === "bot" ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-600"}`}>
                    {msg.type === "bot" ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  </div>
                  <div className={`px-4 py-3 rounded-2xl ${msg.type === "patient" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-gray-100 text-gray-900 rounded-tl-sm"}`}>
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start animate-in fade-in duration-300">
                <div className="flex gap-3 max-w-[80%] flex-row">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-gray-100 text-gray-900 rounded-tl-sm flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                </div>
              </div>
            )}

            {session?.isComplete && session.appointment && (
              <div className="flex justify-center my-6 animate-in slide-in-from-bottom-4 duration-500">
                <Card className="w-full max-w-sm bg-green-50/50 border-green-100">
                  <div className="p-6 text-center">
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">Appointment Confirmed</h3>
                    <p className="text-gray-500 mb-6">Your booking has been successfully scheduled.</p>
                    
                    <div className="bg-white rounded-xl p-4 text-left space-y-3 shadow-sm border border-gray-100">
                      <div className="flex justify-between border-b border-gray-50 pb-2">
                        <span className="text-gray-500">Patient</span>
                        <span className="font-medium text-gray-900">{session.appointment.patientName}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-50 pb-2">
                        <span className="text-gray-500">Date</span>
                        <span className="font-medium text-gray-900">{session.appointment.appointmentDate}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-50 pb-2">
                        <span className="text-gray-500">Clinic</span>
                        <span className="font-medium text-gray-900">{clinic?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Status</span>
                        <span className="font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-sm uppercase tracking-wide">Pending</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="p-4 bg-white border-t border-gray-100">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={session?.isComplete ? "Chat finished..." : "Type your message..."}
              className="flex-1 rounded-full px-6 h-12 bg-gray-50 border-transparent focus-visible:bg-white transition-colors"
              disabled={!session || session.isComplete || isTyping || sendMessage.isPending}
            />
            <Button 
              type="submit" 
              size="icon" 
              className="w-12 h-12 rounded-full shrink-0 shadow-sm"
              disabled={!inputValue.trim() || !session || session.isComplete || isTyping || sendMessage.isPending}
            >
              {sendMessage.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
