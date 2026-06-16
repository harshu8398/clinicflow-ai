import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Hospital, Loader2, AlertCircle, CheckCircle2, ArrowLeft, RefreshCw } from "lucide-react";

type LoginView = "login" | "forgot" | "reset";

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [view, setView] = useState<LoginView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Forgot password state
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cooldown, setCooldown] = useState(0);
  
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manage resend cooldown timer lifecycle
  useEffect(() => {
    if (cooldown === 0) return;
    const interval = setInterval(() => {
      setCooldown((current) => {
        if (current <= 1) {
          clearInterval(interval);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
      return;
    }
    setError("");
    setMessage("");
    setIsSubmitting(true);
    const result = await login(email.trim(), password);
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    
    const res = await fetch(
      `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/auth/me`,
      { credentials: "include" }
    );
    if (res.ok) {
      const data = await res.json();
      setLocation(`/admin/${data.clinicId}`);
    }
  };

  const startCooldown = () => {
    setCooldown(60);
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email address is required");
      return;
    }
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        }
      );
      const data = await res.json();
      setIsSubmitting(false);
      
      if (!res.ok) {
        setError(data.error || "Failed to request code");
        return;
      }
      
      setMessage("Verification OTP sent to your registered email address.");
      setView("reset");
      startCooldown();
    } catch (err) {
      setIsSubmitting(false);
      setError("An unexpected error occurred");
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        }
      );
      const data = await res.json();
      setIsSubmitting(false);

      if (!res.ok) {
        setError(data.error || "Failed to resend OTP");
        return;
      }

      setMessage("A new verification code has been sent to your email.");
      startCooldown();
    } catch (err) {
      setIsSubmitting(false);
      setError("An unexpected error occurred while resending OTP");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCode.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setError("All fields are required");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation password do not match");
      return;
    }
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/auth/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            code: resetCode.trim(),
            newPassword: newPassword,
            confirmPassword: confirmPassword,
          }),
        }
      );
      const data = await res.json();
      setIsSubmitting(false);

      if (!res.ok) {
        setError(data.error || "Failed to reset password");
        return;
      }

      setMessage("Password reset successful. Please sign in with your new password.");
      setView("login");
      setPassword("");
      setResetCode("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setIsSubmitting(false);
      setError("An unexpected error occurred");
    }
  };

  const switchToView = (targetView: LoginView) => {
    setError("");
    setMessage("");
    setView(targetView);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
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
          {view === "login" && (
            <>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Sign in to your clinic</CardTitle>
                <CardDescription>Use your admin credentials to access the dashboard</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitLogin} className="space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-100">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {message && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700 text-sm border border-green-100">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{message}</span>
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
                    <div className="flex justify-between items-center">
                      <Label htmlFor="password">Password</Label>
                      <button
                        type="button"
                        onClick={() => switchToView("forgot")}
                        className="text-xs text-primary hover:underline font-semibold bg-transparent border-0 p-0 cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
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
            </>
          )}

          {view === "forgot" && (
            <>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <button
                    type="button"
                    onClick={() => switchToView("login")}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer p-0 bg-transparent border-0 flex items-center justify-center"
                    title="Back to login"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <CardTitle className="text-lg">Forgot password?</CardTitle>
                </div>
                <CardDescription>Enter your email to receive a secure OTP code</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRequestCode} className="space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-100">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email">Email address</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="admin@yourclinic.clinic"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isSubmitting}
                      autoComplete="email"
                      autoFocus
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending code…
                      </>
                    ) : (
                      "Send OTP Code"
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          )}

          {view === "reset" && (
            <>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <button
                    type="button"
                    onClick={() => switchToView("forgot")}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer p-0 bg-transparent border-0 flex items-center justify-center"
                    title="Back to email input"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <CardTitle className="text-lg">Verify & Reset</CardTitle>
                </div>
                <CardDescription>Enter the code sent to your email and your new password</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-100">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {message && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700 text-sm border border-green-100">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{message}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="reset-code">6-Digit Verification Code</Label>
                    <Input
                      id="reset-code"
                      type="text"
                      placeholder="123456"
                      maxLength={6}
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      disabled={isSubmitting}
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isSubmitting}
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isSubmitting}
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="flex items-center justify-between py-1 text-xs">
                    <span className="text-gray-500">Didn't receive the email?</span>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={cooldown > 0 || isSubmitting}
                      className={`font-semibold flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer ${
                        cooldown > 0 || isSubmitting
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-primary hover:underline"
                      }`}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? "animate-spin" : ""}`} />
                      {cooldown > 0 ? `Resend OTP (${cooldown}s)` : "Resend OTP"}
                    </button>
                  </div>

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Resetting password…
                      </>
                    ) : (
                      "Reset Password"
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-center text-xs text-gray-400">
          Patient? <a href="/" className="text-primary hover:underline">Book an appointment</a>
        </p>
      </div>
    </div>
  );
}
