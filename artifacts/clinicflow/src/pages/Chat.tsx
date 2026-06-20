import { useState, useEffect, useRef } from "react";
import { useParams, useSearch } from "wouter";
import { useStartChat, useSendChatMessage, ChatResponse } from "@workspace/api-client-react";
import { useGetClinic } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Send, Loader2, Hospital, Bot, User, CheckCircle2, CalendarIcon, ShieldAlert, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { getImageUrl } from "@/lib/image";

type Message = {
  id: string;
  type: "bot" | "patient";
  content: string;
};

const SESSION_KEY = "clinicflow_session_";

export default function Chat() {
  const { clinicId } = useParams();
  const search = useSearch();
  const id = Number(clinicId);
  const token = new URLSearchParams(search).get("token");
  const { data: clinic } = useGetClinic(id);
  const startChat = useStartChat();
  const sendMessage = useSendChatMessage();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [session, setSession] = useState<{ id: string; step: string; isComplete: boolean; appointment?: any } | null>(null);
  const [context, setContext] = useState<any>({});
  const [isTyping, setIsTyping] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [accessDenied, setAccessDenied] = useState(false);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const isDateStep = session?.step === "ask_date" && !session.isComplete;
  const isDisabled = !session || session.isComplete || isTyping || sendMessage.isPending;

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session?.step === "ask_slot" && context.appointmentDate) {
      setSlotsLoading(true);
      fetch(`/api/clinics/${id}/slots?date=${context.appointmentDate}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch slots");
          return res.json();
        })
        .then((data) => {
          if (Array.isArray(data) && data.length === 0) {
            const botMessage = "No available slots remain for this date.\n\nPlease select another appointment date.";
            const botMsgObj: Message = {
              id: (Date.now() + 1).toString(),
              type: "bot",
              content: botMessage
            };
            const newSession = { ...session!, step: "ask_date" };
            const updatedMessages = [...messages, botMsgObj];
            setSession(newSession);
            setMessages(updatedMessages);
            persistState(newSession, updatedMessages, context);
            setSlots([]);
          } else {
            setSlots(data);
          }
          setSlotsLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setSlots([]);
          setSlotsLoading(false);
        });
    }
  }, [session?.step, context.appointmentDate, id, messages, session, context]);

  useEffect(() => {
    if (!isDisabled) {
      inputRef.current?.focus();
    }
  }, [isDisabled]);

  const handleSlotSelect = (slot: string) => {
    submitMessage(slot, slot);
  };

  const sessionStorageKey = `${SESSION_KEY}${id}`;

  // No token in URL = direct URL access, reject immediately
  if (!token && !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500 mb-6">Please select a clinic from the homepage to start a chat.</p>
          <a href="/" className="inline-block bg-primary text-white font-medium px-6 py-2.5 rounded-full text-sm hover:opacity-90 transition-opacity">
            Go to Homepage
          </a>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (!id || !token) return;
    const stored = localStorage.getItem(sessionStorageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.session?.isComplete) {
          localStorage.removeItem(sessionStorageKey);
        } else if (parsed.session) {
          setSession(parsed.session);
          setContext(parsed.context || {});
          setMessages(parsed.messages || []);
          return;
        }
      } catch {
        localStorage.removeItem(sessionStorageKey);
      }
    }
    // Start new session — pass token so backend can validate it
    setIsTyping(true);
    startChat.mutate({ clinicId: id, data: { token: token! } }, {
      onSuccess: (res: ChatResponse) => {
        setTimeout(() => {
          const newSession = { id: res.sessionId, step: res.step, isComplete: res.isComplete, appointment: res.appointment };
          const newMessages = [{ id: Date.now().toString(), type: "bot" as const, content: res.botMessage }];
          setSession(newSession);
          setMessages(newMessages);
          setIsTyping(false);
          localStorage.setItem(sessionStorageKey, JSON.stringify({ session: newSession, messages: newMessages, context: {} }));
        }, 500);
      },
      onError: () => {
        setIsTyping(false);
        setAccessDenied(true);
      },
    });
  }, [id, token]);

  const persistState = (newSession: typeof session, newMessages: Message[], newContext: any) => {
    localStorage.setItem(sessionStorageKey, JSON.stringify({ session: newSession, messages: newMessages, context: newContext }));
  };

  const submitMessage = (patientMsg: string, displayMsg: string) => {
    if (!session || session.isComplete || sendMessage.isPending) return;

    const userMessage: Message = { id: Date.now().toString(), type: "patient", content: displayMsg };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    let newContext = { ...context };
    if (session.step === "ask_name") newContext.patientName = patientMsg;
    else if (session.step === "ask_phone") newContext.patientPhone = patientMsg;
    else if (session.step === "ask_problem") newContext.patientProblem = patientMsg;
    else if (session.step === "ask_date") newContext.appointmentDate = patientMsg;
    else if (session.step === "ask_slot") newContext.selectedTimeSlot = patientMsg;

    setContext(newContext);
    setIsTyping(true);
    setSelectedDate(undefined);

    sendMessage.mutate({
      clinicId: id,
      data: {
        sessionId: session.id,
        step: session.step,
        message: patientMsg,
        context: newContext,
      }
    }, {
      onSuccess: (res: ChatResponse) => {
        setTimeout(() => {
          const newSession = { id: res.sessionId, step: res.step, isComplete: res.isComplete, appointment: res.appointment };
          const finalMessages = [...updatedMessages, { id: (Date.now() + 1).toString(), type: "bot" as const, content: res.botMessage }];
          setSession(newSession);
          setMessages(finalMessages);
          setIsTyping(false);
          persistState(newSession, finalMessages, newContext);
        }, 600);
      },
      onError: () => setIsTyping(false),
    });
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !session || session.isComplete || sendMessage.isPending) return;
    const msg = inputValue.trim();
    setInputValue("");
    submitMessage(msg, msg);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date || !session || session.isComplete) return;
    setSelectedDate(date);
    const internalDate = format(date, "yyyy-MM-dd");
    const displayDate = format(date, "dd MMMM yyyy");
    submitMessage(internalDate, displayDate);
  };



  const downloadAppointmentCard = async () => {
    if (!session?.appointment || !clinic) return;

    setIsDownloading(true);
    try {
      const appointment = session.appointment;
      const appointmentId = appointment.id;
      const patientName = appointment.patientName;
      const doctorName = clinic.doctorName || "Doctor";
      const rawDate = appointment.appointmentDate;
      const dateFormatted = (() => {
        const d = new Date(rawDate);
        return isNaN(d.getTime()) ? rawDate : format(d, "dd MMMM yyyy");
      })();
      const timeSlot = appointment.selectedTimeSlot || "N/A";
      const clinicName = clinic.clinicName || "Clinic";
      const clinicAddress = clinic.address || "N/A";
      const clinicPhone = clinic.clinicPhoneNumber || "N/A";
      const statusText = "Confirmed";
      const websiteUrl = window.location.origin;

      // Create canvas
      const canvas = document.createElement("canvas");
      canvas.width = 600;
      canvas.height = 920;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get 2D context");

      // Draw background
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Card geometry
      const cardX = 30;
      const cardY = 30;
      const cardWidth = 540;
      const cardHeight = 860;
      const borderRadius = 24;

      // Shadow
      ctx.shadowColor = "rgba(15, 23, 42, 0.08)";
      ctx.shadowBlur = 25;
      ctx.shadowOffsetY = 10;

      // Draw rounded card
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(cardX, cardY, cardWidth, cardHeight, borderRadius);
      } else {
        ctx.rect(cardX, cardY, cardWidth, cardHeight);
      }
      ctx.fill();

      // Reset shadow
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Draw border
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(cardX, cardY, cardWidth, cardHeight, borderRadius);
      } else {
        ctx.rect(cardX, cardY, cardWidth, cardHeight);
      }
      ctx.stroke();

      // Draw Header Banner
      const headerHeight = 130;
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(cardX, cardY, cardWidth, cardHeight, borderRadius);
      } else {
        ctx.rect(cardX, cardY, cardWidth, cardHeight);
      }
      ctx.clip();

      const grad = ctx.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY);
      grad.addColorStop(0, "#0d9488");
      grad.addColorStop(1, "#0f766e");
      ctx.fillStyle = grad;
      ctx.fillRect(cardX, cardY, cardWidth, headerHeight);
      ctx.restore();

      // Image loader helper
      const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = src;
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("Image load failed"));
        });
      };

      // Draw Logo
      const logoRadius = 32;
      const logoX = cardX + 45;
      const logoY = cardY + 65;

      const drawClinicIconFallback = () => {
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.beginPath();
        ctx.arc(logoX, logoY, logoRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        const crossSize = 10;
        const thickness = 4;
        ctx.fillRect(logoX - crossSize, logoY - thickness / 2, crossSize * 2, thickness);
        ctx.fillRect(logoX - thickness / 2, logoY - crossSize, thickness, crossSize * 2);
      };

      if (clinic.clinicLogo) {
        try {
          const logoImg = await loadImage(getImageUrl(clinic.clinicLogo));
          ctx.save();
          ctx.beginPath();
          ctx.arc(logoX, logoY, logoRadius, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(logoImg, logoX - logoRadius, logoY - logoRadius, logoRadius * 2, logoRadius * 2);
          ctx.restore();
        } catch (e) {
          drawClinicIconFallback();
        }
      } else {
        drawClinicIconFallback();
      }

      // Draw Header Text
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";

      ctx.font = "bold 22px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(clinicName, cardX + 95, cardY + 58);

      ctx.font = "500 14px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      const docSpecialty = clinic.doctorSpecialization ? ` (${clinic.doctorSpecialization})` : "";
      ctx.fillText(`Dr. ${doctorName}${docSpecialty}`, cardX + 95, cardY + 84);

      // Section label
      ctx.fillStyle = "#0d9488";
      ctx.font = "bold 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("APPOINTMENT CARD", cardX + 40, cardY + headerHeight + 40);

      // Divider line
      ctx.strokeStyle = "#f1f5f9";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cardX + 40, cardY + headerHeight + 52);
      ctx.lineTo(cardX + cardWidth - 40, cardY + headerHeight + 52);
      ctx.stroke();

      // Details Grid
      const gridYStart = cardY + headerHeight + 85;

      const drawGridItem = (label: string, value: string, x: number, y: number, isStatusBadge = false) => {
        ctx.fillStyle = "#64748b";
        ctx.font = "600 11px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(label.toUpperCase(), x, y);

        if (isStatusBadge) {
          const badgeText = value.toUpperCase();
          ctx.font = "bold 12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
          const badgeWidth = ctx.measureText(badgeText).width + 16;
          const badgeHeight = 22;

          ctx.fillStyle = "#dcfce7";
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x, y + 8, badgeWidth, badgeHeight, 6);
          } else {
            ctx.rect(x, y + 8, badgeWidth, badgeHeight);
          }
          ctx.fill();

          ctx.fillStyle = "#15803d";
          ctx.fillText(badgeText, x + 8, y + 23);
        } else {
          ctx.fillStyle = "#0f172a";
          ctx.font = "bold 15px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
          let displayVal = value;
          if (ctx.measureText(displayVal).width > 200) {
            displayVal = displayVal.substring(0, 22) + "...";
          }
          ctx.fillText(displayVal, x, y + 23);
        }
      };

      const col1 = cardX + 40;
      const col2 = cardX + 285;

      drawGridItem("Patient Name", patientName, col1, gridYStart);
      drawGridItem("Status", statusText, col2, gridYStart, true);

      drawGridItem("Appointment Date", dateFormatted, col1, gridYStart + 65);
      drawGridItem("Appointment Time", timeSlot, col2, gridYStart + 65);

      drawGridItem("Doctor Name", `Dr. ${doctorName}`, col1, gridYStart + 130);
      drawGridItem("Appointment ID", `#APT-${appointmentId}`, col2, gridYStart + 130);

      // Divider
      const divY2 = gridYStart + 185;
      ctx.strokeStyle = "#f1f5f9";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cardX + 40, divY2);
      ctx.lineTo(cardX + cardWidth - 40, divY2);
      ctx.stroke();

      // Clinic Address & Contact
      const clinicInfoY = divY2 + 30;

      ctx.fillStyle = "#64748b";
      ctx.font = "600 11px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("CLINIC ADDRESS", col1, clinicInfoY);

      ctx.fillStyle = "#0f172a";
      ctx.font = "500 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";

      const addressLines: string[] = [];
      const words = clinicAddress.split(" ");
      let currentLine = "";
      const maxAddrWidth = cardWidth - 80;
      for (let word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(testLine).width > maxAddrWidth) {
          addressLines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) addressLines.push(currentLine);

      let currentY = clinicInfoY + 20;
      addressLines.slice(0, 3).forEach(line => {
        ctx.fillText(line, col1, currentY);
        currentY += 18;
      });

      const contactY = currentY + 10;
      ctx.fillStyle = "#64748b";
      ctx.font = "600 11px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("CONTACT NUMBER", col1, contactY);

      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(clinicPhone, col1, contactY + 18);

      // Divider
      const divY3 = contactY + 45;
      ctx.strokeStyle = "#f1f5f9";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cardX + 40, divY3);
      ctx.lineTo(cardX + cardWidth - 40, divY3);
      ctx.stroke();

      // Instructions & QR Code
      const footerY = divY3 + 30;

      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("Important Instructions", col1, footerY);

      ctx.fillStyle = "#64748b";
      ctx.font = "500 12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("• Please arrive 10 minutes before your slot.", col1, footerY + 22);
      ctx.fillText("• Show this card at reception to check in.", col1, footerY + 38);
      ctx.fillText("• For cancellations, notify at least 2h prior.", col1, footerY + 54);

      const qrSize = 100;
      const qrX = cardX + cardWidth - 40 - qrSize;
      const qrY = footerY - 5;

      const qrData = `Clinic: ${clinicName} | Patient: ${patientName} | Doctor: Dr. ${doctorName} | Date: ${dateFormatted} | Time: ${timeSlot} | ID: ${appointmentId}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;

      const drawFallbackQR = () => {
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(qrX, qrY, qrSize, qrSize);
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(qrX, qrY, qrSize, qrSize);

        ctx.fillStyle = "#334155";
        const blockCount = 8;
        const blockSize = qrSize / blockCount;
        for (let r = 0; r < blockCount; r++) {
          for (let c = 0; c < blockCount; c++) {
            const isAnchor =
              (r < 3 && c < 3) ||
              (r < 3 && c >= blockCount - 3) ||
              (r >= blockCount - 3 && c < 3);

            if (isAnchor) {
              if (r === 0 || r === 2 || c === 0 || c === 2 || (c === blockCount - 1 || c === blockCount - 3) || (r === blockCount - 1 || r === blockCount - 3)) {
                ctx.fillRect(qrX + c * blockSize, qrY + r * blockSize, blockSize, blockSize);
              }
              if ((r === 1 && c === 1) || (r === 1 && c === blockCount - 2) || (r === blockCount - 2 && c === 1)) {
                ctx.fillRect(qrX + c * blockSize, qrY + r * blockSize, blockSize, blockSize);
              }
            } else {
              if ((Math.sin(r * 12.5 + c * 31.7) > 0.1)) {
                ctx.fillRect(qrX + c * blockSize, qrY + r * blockSize, blockSize, blockSize);
              }
            }
          }
        }
      };

      try {
        const qrImg = await loadImage(qrUrl);
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
      } catch (err) {
        drawFallbackQR();
      }

      ctx.textAlign = "center";
      ctx.fillStyle = "#94a3b8";
      ctx.font = "600 9px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("SCAN DETAILS", qrX + qrSize / 2, qrY + qrSize + 12);

      // Download
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `Appointment-Card-${clinicName.replace(/\s+/g, "-")}-${appointmentId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to generate appointment card:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Invalid/expired/already-used token
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500 mb-6">This link is invalid or has already been used. Please go back and select a clinic again.</p>
          <a href="/" className="inline-block bg-primary text-white font-medium px-6 py-2.5 rounded-full text-sm hover:opacity-90 transition-opacity">
            Go to Homepage
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-8 px-4 pb-8">
      <div className="w-full max-w-2xl flex-1 flex flex-col bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="bg-primary px-6 py-4 flex items-center justify-between shadow-sm z-10 relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Hospital className="text-white w-6 h-6" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg">{clinic?.name || "Clinic"} Reception</h2>
              <p className="text-primary-foreground/80 text-sm flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse"></span>
                Online — Replies instantly
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-6 relative">
          <div className="space-y-6">
            {messages.map((msg) => (
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

            {/* Typing indicator */}
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

            {/* Inline calendar when at date step */}
            {isDateStep && !isTyping && (
              <div className="flex justify-start animate-in slide-in-from-bottom-2 fade-in duration-300">
                <div className="flex gap-3 flex-row">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-primary/10 text-primary mt-1">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-sm p-3 shadow-sm">
                    <p className="text-xs text-gray-500 mb-2 font-medium px-1">Select your preferred date</p>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      disabled={(date) => date < today}
                      className="rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Slot selection when at slot step */}
            {session?.step === "ask_slot" && !isTyping && (
              <div className="flex justify-start animate-in slide-in-from-bottom-2 fade-in duration-300">
                <div className="flex gap-3 flex-row">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-primary/10 text-primary mt-1">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-sm p-4 shadow-sm w-full max-w-sm animate-in slide-in-from-bottom-2 duration-300">
                    <p className="text-xs text-gray-500 mb-3 font-medium">
                      Selected Date: {(() => {
                        const d = new Date(context.appointmentDate);
                        return isNaN(d.getTime()) ? context.appointmentDate : format(d, "dd MMMM yyyy");
                      })()}
                    </p>
                    <p className="text-[13px] font-semibold text-gray-700 mb-2">Available Slots:</p>
                    {slotsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500 py-1">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span>Fetching slots...</span>
                      </div>
                    ) : slots && slots.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {slots.map((slot) => (
                          <Button
                            key={slot}
                            variant="outline"
                            size="sm"
                            className="text-xs border-primary/20 hover:bg-primary hover:text-white transition-colors"
                            onClick={() => handleSlotSelect(slot)}
                          >
                            {slot}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-red-500 font-medium py-1">
                        {(() => {
                          const appointmentDateStr = context.appointmentDate;
                          if (appointmentDateStr) {
                            const now = new Date();
                            const year = now.getFullYear();
                            const month = String(now.getMonth() + 1).padStart(2, "0");
                            const day = String(now.getDate()).padStart(2, "0");
                            const todayStr = `${year}-${month}-${day}`;
                            if (appointmentDateStr === todayStr) {
                              return "No available slots remain for today. Please select another date.";
                            }
                          }
                          return "No available slots for this date. Please select another date.";
                        })()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Booking confirmation summary when at confirm step */}
            {session?.step === "confirm_booking" && !isTyping && (
              <div className="flex justify-start animate-in slide-in-from-bottom-2 fade-in duration-300">
                <div className="flex gap-3 flex-row w-full">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-primary/10 text-primary mt-1">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-sm p-4 shadow-sm w-full max-w-sm">
                    <p className="text-xs text-gray-500 mb-3 font-medium">Please review your booking details</p>
                    <div className="bg-white rounded-xl p-4 text-left space-y-3 shadow-sm border border-gray-100 mb-4">
                      <div className="flex justify-between border-b border-gray-50 pb-2">
                        <span className="text-gray-500 text-sm">Patient</span>
                        <span className="font-medium text-gray-900 text-sm">{context.patientName}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-50 pb-2">
                        <span className="text-gray-500 text-sm">Date</span>
                        <span className="font-medium text-gray-900 text-sm">
                          {(() => {
                            const d = new Date(context.appointmentDate);
                            return isNaN(d.getTime()) ? context.appointmentDate : format(d, "dd MMMM yyyy");
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-gray-50 pb-2">
                        <span className="text-gray-500 text-sm">Time</span>
                        <span className="font-medium text-gray-900 text-sm">{context.selectedTimeSlot}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-sm">Doctor</span>
                        <span className="font-medium text-gray-900 text-sm">{clinic?.doctorName}</span>
                      </div>
                    </div>
                    <Button
                      className="w-full rounded-full"
                      onClick={() => submitMessage("confirm", "Confirm Booking")}
                      disabled={sendMessage.isPending}
                    >
                      {sendMessage.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Confirm Booking
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Confirmation card */}
            {session?.isComplete && session.appointment && (
              <div className="flex justify-center my-6 animate-in slide-in-from-bottom-4 duration-500">
                <Card className="w-full max-w-sm bg-green-50/50 border-green-100">
                  <div className="p-6 text-center">
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">Booking Confirmed</h3>
                    <p className="text-gray-500 mb-6">Your slot has been synchronized and confirmed.</p>
                    <div className="bg-white rounded-xl p-4 text-left space-y-3 shadow-sm border border-gray-100">
                      <div className="flex justify-between border-b border-gray-50 pb-2">
                        <span className="text-gray-500 text-sm">Patient</span>
                        <span className="font-medium text-gray-900 text-sm">{session.appointment.patientName}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-50 pb-2">
                        <span className="text-gray-500 text-sm">Doctor</span>
                        <span className="font-medium text-gray-900 text-sm">{clinic?.doctorName}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-50 pb-2">
                        <span className="text-gray-500 text-sm">Date</span>
                        <span className="font-medium text-gray-900 text-sm">
                          {(() => {
                            const d = new Date(session.appointment.appointmentDate);
                            return isNaN(d.getTime()) ? session.appointment.appointmentDate : format(d, "dd MMMM yyyy");
                          })()}
                        </span>
                      </div>
                      {session.appointment.selectedTimeSlot && (
                        <div className="flex justify-between border-b border-gray-50 pb-2">
                          <span className="text-gray-500 text-sm">Time Slot</span>
                          <span className="font-medium text-gray-900 text-sm">{session.appointment.selectedTimeSlot}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-sm">Status</span>
                        <span className="font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded text-sm">Confirmed</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full mt-4 rounded-full border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 flex items-center justify-center gap-2 font-semibold shadow-sm transition-all duration-200 hover:scale-[1.01]"
                      onClick={downloadAppointmentCard}
                      disabled={isDownloading}
                    >
                      {isDownloading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-green-700" />
                      ) : (
                        <Download className="w-4 h-4 text-green-700" />
                      )}
                      {isDownloading ? "Generating Card..." : "Download Appointment Card"}
                    </Button>
                  </div>
                </Card>
              </div>
            )}

            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="p-4 bg-white border-t border-gray-100">
          {isDateStep ? (
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-full text-sm text-gray-400 border border-dashed border-gray-200">
              <CalendarIcon className="w-4 h-4 shrink-0" />
              <span>Pick a date from the calendar above</span>
            </div>
          ) : (
            <form onSubmit={handleTextSubmit} className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  session?.isComplete
                    ? "Booking complete"
                    : session?.step === "ask_slot"
                    ? "Type your preferred slot (e.g. 10:00 AM)..."
                    : session?.step === "confirm_booking"
                    ? "Type 'confirm' to book..."
                    : "Type your message..."
                }
                className="flex-1 rounded-full px-6 h-12 bg-gray-50 border-transparent focus-visible:bg-white transition-colors"
                disabled={isDisabled}
                autoFocus
              />
              <Button
                type="submit"
                size="icon"
                className="w-12 h-12 rounded-full shrink-0 shadow-sm"
                disabled={!inputValue.trim() || isDisabled}
              >
                {sendMessage.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
