import "express-session";

declare module "express-session" {
  interface SessionData {
    authenticated: boolean;
    userId: number;
    clinicId: number;
    role: string;
  }
}
