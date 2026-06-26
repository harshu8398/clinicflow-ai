import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft, RefreshCw } from "lucide-react";

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
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      {/* Left side: Premium Clinical/SaaS Banner Panel (Desktop only) */}
      <div className="hidden md:flex md:w-1/2 bg-slate-900 text-white p-16 flex-col justify-between relative overflow-hidden select-none">
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-slate-900 to-slate-950 z-0" />
        <div className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-secondary/15 rounded-full blur-[100px] pointer-events-none" />
        
        {/* Top Header Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <img 
            src="/logo.png" 
            alt="ClinicFlow Logo" 
            className="h-10 w-auto object-contain shrink-0"
          />
          <div>
            <span className="text-xl font-bold tracking-tight text-white block leading-tight font-display">
              ClinicFlow
            </span>
          </div>
        </div>

        {/* Feature Highlights Text */}
        <div className="space-y-6 relative z-10 my-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-xs font-semibold tracking-wide text-primary-foreground">
            ✨ Clinic Login v2.0
          </div>
          <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight font-display">
            Your Clinical Operations, <br/>
            <span className="text-primary-foreground">Perfected.</span>
          </h2>
          <p className="text-slate-300 text-base max-w-md leading-relaxed">
            Monitor real-time patient conversations, streamline doctor appointment queues, and track verification metrics from a clean, unified workspace.
          </p>
        </div>

        {/* Footer info */}
        <div className="text-slate-400 text-xs relative z-10">
          © {new Date().getFullYear()} ClinicFlow. Your 24x7 Digital Receptionist.
        </div>
      </div>

      {/* Right side: Login Panel Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative z-10 bg-slate-50">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Header (Hidden on Desktop) */}
          <div className="text-center md:hidden">
            <img 
              src="/logo.png" 
              alt="ClinicFlow Logo" 
              className="h-12 w-auto mx-auto mb-3 object-contain"
            />
            <h1 className="text-2xl font-bold text-slate-900 font-display">ClinicFlow</h1>
            <p className="text-slate-500 text-xs">Clinic Login</p>
          </div>

          <Card className="border-slate-100 shadow-lg bg-white rounded-2xl overflow-hidden">
            {view === "login" && (
              <>
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl font-bold text-slate-800 font-display">Sign in to your ClinicFlow account</CardTitle>
                  <CardDescription className="text-xs">Use your credentials to access the clinic.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmitLogin} className="space-y-4">
                    {error && (
                      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-100">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}

                    {message && (
                      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-green-50 text-green-700 text-xs border border-green-100">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{message}</span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="admin@clinic.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isSubmitting}
                        autoComplete="email"
                        autoFocus
                        className="rounded-lg"
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
                        className="rounded-lg"
                      />
                    </div>

                    <Button type="submit" className="w-full font-semibold shadow-sm mt-2" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Signing in…
                        </>
                      ) : (
                        "Sign In"
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
                      className="text-slate-400 hover:text-slate-600 cursor-pointer p-0 bg-transparent border-0 flex items-center justify-center rounded-lg hover:bg-slate-100 w-7 h-7 transition-colors"
                      title="Back to login"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <CardTitle className="text-xl font-bold text-slate-800 font-display">Reset Password</CardTitle>
                  </div>
                  <CardDescription className="text-xs">Enter your email and we'll send a secure OTP verification code.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRequestCode} className="space-y-4">
                    {error && (
                      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-100">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="forgot-email">Email Address</Label>
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="admin@clinic.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isSubmitting}
                        autoComplete="email"
                        autoFocus
                        className="rounded-lg"
                      />
                    </div>

                    <Button type="submit" className="w-full font-semibold shadow-sm mt-2" disabled={isSubmitting}>
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
                      className="text-slate-400 hover:text-slate-600 cursor-pointer p-0 bg-transparent border-0 flex items-center justify-center rounded-lg hover:bg-slate-100 w-7 h-7 transition-colors"
                      title="Back"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <CardTitle className="text-xl font-bold text-slate-800 font-display">Verify Code</CardTitle>
                  </div>
                  <CardDescription className="text-xs">Provide the 6-digit OTP code sent to your email to configure a new password.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    {error && (
                      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-100">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}

                    {message && (
                      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-green-50 text-green-700 text-xs border border-green-100">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{message}</span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="reset-code">6-Digit OTP Verification Code</Label>
                      <Input
                        id="reset-code"
                        type="text"
                        placeholder="123456"
                        maxLength={6}
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        disabled={isSubmitting}
                        autoFocus
                        className="rounded-lg tracking-[0.2em] text-center font-bold text-lg"
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
                        className="rounded-lg"
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
                        className="rounded-lg"
                      />
                    </div>

                    <div className="flex items-center justify-between py-1 text-xs">
                      <span className="text-slate-400">Didn't receive email?</span>
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={cooldown > 0 || isSubmitting}
                        className={`font-semibold flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer ${
                          cooldown > 0 || isSubmitting
                            ? "text-slate-400 cursor-not-allowed"
                            : "text-primary hover:underline"
                        }`}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? "animate-spin" : ""}`} />
                        {cooldown > 0 ? `Resend (${cooldown}s)` : "Resend OTP"}
                      </button>
                    </div>

                    <Button type="submit" className="w-full font-semibold shadow-sm mt-2" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving password…
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

          <p className="text-center text-xs text-slate-400">
            Don't have a ClinicFlow account yet?{" "}
            <Link href="/?register=true">
              <span className="text-primary hover:underline font-semibold cursor-pointer">
                Register Your Clinic
              </span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
