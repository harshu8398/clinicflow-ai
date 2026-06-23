import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useGetClinic } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Link } from "wouter";
import { 
  LayoutDashboard, 
  CalendarDays, 
  Settings as SettingsIcon, 
  MessageCircleQuestion,
  LogOut,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Hospital,
  FileText,
  FileClock
} from "lucide-react";
import ExpiredOverlay from "@/components/ExpiredOverlay";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { clinicId } = useParams();
  const [location, setLocation] = useLocation();
  const id = Number(clinicId);
  const { data: clinic } = useGetClinic(id);
  const { user, logout } = useAuth();

  const [subData, setSubData] = useState<any>(null);
  const [loadingSub, setLoadingSub] = useState(true);

  const fetchSubStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/subscriptions/my-status`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setSubData(data);
      }
    } catch (err) {
      console.error("Failed to load subscription status:", err);
    } finally {
      setLoadingSub(false);
    }
  }, []);

  useEffect(() => {
    fetchSubStatus();
  }, [fetchSubStatus]);

  const handleLogout = async () => {
    await logout();
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.location.replace(`${base}/login`);
  };

  const handleStopImpersonation = async () => {
    try {
      console.log("[Impersonation] Requesting stop impersonation...");
      const res = await fetch(
        `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/subscriptions/stop-impersonation`,
        { method: "POST", credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        console.log("[Impersonation] Stop impersonation success, redirecting to clinic ID:", data.clinicId);
        window.location.replace(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/admin/${data.clinicId}`);
      } else {
        const errorText = await res.text();
        console.error(`[Impersonation] Stop impersonation failed: ${res.status} ${res.statusText}`, errorText);
        alert("Failed to stop impersonation session. Please check console logs.");
      }
    } catch (err) {
      console.error("[Impersonation] Network error during stop impersonation:", err);
      alert("Network error: Failed to reach the server.");
    }
  };

  const handleSubmitProof = async (plan: string, amount: string, base64Image: string, notes: string) => {
    const res = await fetch(
      `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/subscriptions/requests`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planType: plan, amount, screenshot: base64Image, notes }),
      }
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to submit verification request");
    }
    await fetchSubStatus();
  };

  const isSystemOwner = user?.role === "system_owner";

  // Build links list
  const links = isSystemOwner
    ? [
        { href: "/", label: "Platform Overview", icon: LayoutDashboard, exact: true },
        { href: "/clinics", label: "Clinics", icon: Hospital },
        { href: "/subscription-management", label: "Subscription Management", icon: ShieldCheck },
        { href: "/subscription-requests", label: "Subscription Requests", icon: FileText },
        { href: "/subscription-settings", label: "Subscription Settings", icon: SettingsIcon },
        { href: "/audit-logs", label: "Audit Logs", icon: FileClock },
      ]
    : [
        { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
        { href: "/appointments", label: "Appointments", icon: CalendarDays },
        { href: "/faqs", label: "FAQs", icon: MessageCircleQuestion },
        { href: "/settings", label: "Settings", icon: SettingsIcon },
      ];

  // Check if account status blocks modifying operations
  const subStatus = subData?.clinic?.subscriptionStatus ?? "Active";
  const planType = subData?.clinic?.planType ?? "Demo";
  const isBlocked = !isSystemOwner && ["Expired", "Suspended", "Pending Verification", "Rejected"].includes(subStatus);
  const isImpersonating = !!subData?.impersonating;

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans">
      {/* Impersonation sticky top banner */}
      {isImpersonating && (
        <div className="bg-amber-500 text-white text-xs font-semibold px-6 py-3 flex items-center justify-between z-50 sticky top-0 shadow-md">
          <span className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
            <span>Viewing: <strong className="underline">{clinic?.name || "Clinic"}</strong> as System Owner.</span>
          </span>
          <button
            onClick={handleStopImpersonation}
            className="bg-white hover:bg-slate-100 text-amber-900 rounded-lg px-3 py-1 font-semibold transition-all shadow-sm border-0 cursor-pointer text-xs"
          >
            Return To System Owner
          </button>
        </div>
      )}

      {/* Global Subscription Warning Bar */}
      {isBlocked && (
        <div className="bg-red-500 text-white text-xs font-semibold px-6 py-2.5 flex items-center justify-between z-40 shadow-sm sticky" style={{ top: isImpersonating ? "42px" : "0px" }}>
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse" />
            {subStatus === "Suspended" ? (
              <span>Your account has been suspended. Please contact support.</span>
            ) : subStatus === "Pending Verification" ? (
              <span>Your payment proof has been submitted. Awaiting verification from the system owner.</span>
            ) : (
              <span>Your subscription has expired. Please renew on the Dashboard to continue using the system.</span>
            )}
          </span>
          {location !== "/" && !["Suspended", "Pending Verification"].includes(subStatus) && (
            <button
              onClick={() => setLocation("/")}
              className="bg-white text-red-700 hover:bg-slate-100 rounded-lg px-3 py-1 font-semibold transition-colors border-0 cursor-pointer text-[10px] uppercase shadow-xs"
            >
              Renew Now
            </button>
          )}
        </div>
      )}

      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-slate-100 flex flex-col fixed inset-y-0 left-0 z-30 shadow-xs" style={{ top: isImpersonating ? "42px" : "0px" }}>
          <div className="p-6 border-b border-slate-50 flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="ClinicFlow Logo" 
              className="h-10 w-auto object-contain shrink-0"
            />
            <div className="truncate flex-1">
              {isSystemOwner ? (
                <>
                  <h2 className="text-sm font-bold text-slate-800 truncate font-display">System Settings</h2>
                  <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded tracking-wider uppercase inline-block mt-0.5 border border-primary/20">
                    Owner Portal
                  </span>
                </>
              ) : (
                <>
                  <h2 className="text-sm font-bold text-slate-800 truncate font-display" title={clinic?.name}>{clinic?.name || "ClinicFlow"}</h2>
                  <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase inline-block mt-0.5">
                    Clinic Admin
                  </span>
                </>
              )}
            </div>
          </div>
          <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
            {links.map((link) => {
              const isActive = link.exact ? location === link.href : location.startsWith(link.href);
              return (
                <Link key={link.href} href={link.href}>
                  <div
                    className={`flex items-center px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer border ${
                      isActive
                        ? "bg-primary/5 text-primary border-primary/10 shadow-xs"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-800 border-transparent"
                    }`}
                  >
                    <link.icon className={`w-4.5 h-4.5 mr-3 shrink-0 ${isActive ? "text-primary" : "text-slate-400"}`} />
                    {link.label}
                  </div>
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-slate-50">
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-3.5 py-2.5 text-xs font-semibold text-slate-600 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer bg-transparent border border-transparent"
            >
              <LogOut className="w-4.5 h-4.5 mr-3 text-slate-400" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 ml-64 flex flex-col min-h-screen">
          <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center px-8 justify-between sticky top-0 z-20">
            <h1 className="text-base font-bold text-slate-800 font-display">
              {links.find((l) => (l.exact ? location === l.href : location.startsWith(l.href)))?.label || 
               (isSystemOwner ? "Platform Overview" : "Dashboard")}
            </h1>
            {!isSystemOwner && (
              <div className="flex items-center gap-4">
                <a
                  href={`/chat/${id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-primary hover:text-primary-hover border border-primary/20 bg-primary/5 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                >
                  Patient Chat Portal ↗
                </a>
              </div>
            )}
          </header>
          <main className="flex-1 p-8 relative">
            {loadingSub ? (
              <div className="min-h-[50vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : isBlocked && location === "/" ? (
              /* If blocked and on Dashboard, immediately show the Expired overlay in full view */
              <ExpiredOverlay
                status={subStatus}
                planType={planType}
                upiId={subData?.settings?.upiId || "8178141497@jio"}
                qrCodeUrl={subData?.settings?.upiQrCodeUrl}
                monthlyPrice={subData?.settings?.monthlyPrice || "999"}
                quarterlyPrice={subData?.settings?.quarterlyPrice || "2699"}
                yearlyPrice={subData?.settings?.yearlyPrice || "8999"}
                supportContact={subData?.settings?.supportContact || "+91 8178141497"}
                supportWhatsapp={subData?.settings?.supportWhatsapp || "+91 8178141497"}
                onSubmitProof={handleSubmitProof}
                isLoadingStatus={loadingSub}
              />
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
