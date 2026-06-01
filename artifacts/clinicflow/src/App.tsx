import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Chat from "@/pages/Chat";
import AdminLayout from "@/pages/AdminLayout";
import Dashboard from "@/pages/admin/Dashboard";
import Appointments from "@/pages/admin/Appointments";
import Settings from "@/pages/admin/Settings";
import Faqs from "@/pages/admin/Faqs";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/chat/:clinicId" component={Chat} />
      <Route path="/admin/:clinicId" nest>
        <AdminLayout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/appointments" component={Appointments} />
            <Route path="/settings" component={Settings} />
            <Route path="/faqs" component={Faqs} />
            <Route component={NotFound} />
          </Switch>
        </AdminLayout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
