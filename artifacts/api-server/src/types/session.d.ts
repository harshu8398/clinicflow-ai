import "express-session";

declare module "express-session" {
  interface SessionData {
    authenticated: boolean;
    userId: number;
    clinicId: number;
    role: string;
    resetCode?: string;
    resetEmail?: string;
    resetCodeExpiresAt?: number;
    resetOtp?: string;
    resetOtpEmail?: string;
    resetOtpExpiresAt?: number;
    resetOtpLastSentAt?: number;
  }
}
