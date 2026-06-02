import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Hospital, Loader2, AlertCircle } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
      return;
    }
    setError("");
    setIsSubmitting(true);
    const result = await login(email.trim(), password);
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    // login() sets user; App will re-render and the user will be redirected by the auth context
    // We navigate to /admin/:clinicId via the response
    const res = await fetch(
      `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/auth/me`,
      { credentials: "include" }
    );
    if (res.ok) {
      const data = await res.json();
      setLocation(`/admin/${data.clinicId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Hospital className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ClinicFlow AI</h1>
          <p className="text-gray-500 text-sm mt-1">Admin Portal</p>
        </div>

        <Card className="border-gray-100 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Sign in to your clinic</CardTitle>
            <CardDescription>Use your admin credentials to access the dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-100">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@yourclinic.clinic"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  autoComplete="current-password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-400">
          Patient? <a href="/" className="text-primary hover:underline">Book an appointment</a>
        </p>
      </div>
    </div>
  );
}
