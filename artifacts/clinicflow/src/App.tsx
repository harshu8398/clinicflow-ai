import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, useParams } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Chat from "@/pages/Chat";
import Login from "@/pages/Login";
import AdminLayout from "@/pages/AdminLayout";
import Dashboard from "@/pages/admin/Dashboard";
import Appointments from "@/pages/admin/Appointments";
import Settings from "@/pages/admin/Settings";
import Faqs from "@/pages/admin/Faqs";
import PublicBook from "@/pages/PublicBook";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const { clinicId } = useParams<{ clinicId: string }>();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      window.location.replace(`${base}/login`);
    }
  }, [isLoading, user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const requestedClinicId = Number(clinicId);
  if (user.clinicId !== requestedClinicId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-sm">
          <div className="text-6xl font-bold text-gray-200 mb-2">403</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500 mb-6">You do not have permission to access this clinic's dashboard.</p>
          <button
            className="text-primary hover:underline text-sm font-medium"
            onClick={() => {
              const base = import.meta.env.BASE_URL.replace(/\/$/, "");
              window.location.replace(`${base}/admin/${user.clinicId}`);
            }}
          >
            Go to your clinic →
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/chat/:clinicId" component={Chat} />
      <Route path="/book/:slug" component={PublicBook} />
      <Route path="/admin/:clinicId" nest>
        <ProtectedAdminRoute>
          <AdminLayout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/appointments" component={Appointments} />
              <Route path="/settings" component={Settings} />
              <Route path="/faqs" component={Faqs} />
              <Route component={NotFound} />
            </Switch>
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
