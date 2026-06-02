import { useParams, useLocation } from "wouter";
import { useGetClinic } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Link } from "wouter";
import { 
  LayoutDashboard, 
  CalendarDays, 
  Settings as SettingsIcon, 
  MessageCircleQuestion,
  LogOut
} from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { clinicId } = useParams();
  const [location, setLocation] = useLocation();
  const id = Number(clinicId);
  const { data: clinic } = useGetClinic(id);
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.location.replace(`${base}/login`);
  };

  // Inside a nested wouter context (/admin/:clinicId), hrefs are relative to the nest base.
  // Use "/" for dashboard, "/appointments" etc. for sub-pages.
  // Prefix with "~" to escape the nest for absolute routes like /chat/:id.
  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/appointments", label: "Appointments", icon: CalendarDays },
    { href: "/faqs", label: "FAQs", icon: MessageCircleQuestion },
    { href: "/settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col fixed inset-y-0 left-0">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 truncate">{clinic?.name || "ClinicFlow"}</h2>
          <p className="text-sm text-gray-500">Admin Portal</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {links.map(link => {
            const isActive = link.exact ? location === link.href : location.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href}>
                <div className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer ${isActive ? "bg-primary/10 text-primary" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`}>
                  <link.icon className={`w-5 h-5 mr-3 ${isActive ? "text-primary" : "text-gray-400"}`} />
                  {link.label}
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 text-sm font-medium text-gray-600 rounded-lg hover:bg-red-50 hover:text-red-700 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3 text-gray-400" />
            Sign out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8 justify-between sticky top-0 z-10">
          <h1 className="text-lg font-medium text-gray-900">
            {links.find(l => (l.exact ? location === l.href : location.startsWith(l.href)))?.label || "Dashboard"}
          </h1>
          <div className="flex items-center gap-4">
            <a href={`/chat/${id}`} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline font-medium">
              Open Patient Chat ↗
            </a>
          </div>
        </header>
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
