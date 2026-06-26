import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col relative overflow-hidden font-sans">
      {/* Navigation Header */}
      <header className="w-full bg-white/70 backdrop-blur-md border-b border-slate-100 sticky top-0 z-40 transition-all duration-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer">
              <img 
                src="/logo.png" 
                alt="ClinicFlow Logo" 
                className="h-10 w-auto object-contain shrink-0"
              />
              <div>
                <span className="text-xl font-bold tracking-tight text-slate-900 block leading-tight font-display">
                  ClinicFlow
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block leading-none">
                  Your 24x7 Digital Receptionist
                </span>
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium cursor-pointer">
                Clinic Login
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl w-full mx-auto px-6 py-12 flex-1">
        <div className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-12 shadow-sm space-y-8">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-6">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
              <Shield className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-display">
                Privacy Policy
              </h1>
              <p className="text-xs text-slate-400 mt-1">Last Updated: June 24, 2026</p>
            </div>
          </div>

          <div className="prose prose-slate max-w-none text-xs sm:text-sm text-slate-650 leading-relaxed space-y-6">
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 font-display">1. Introduction</h2>
              <p>
                Welcome to <strong>ClinicFlow</strong>. We value your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, and safeguard personal information when you use our ClinicFlow SaaS platform and clinic booking widgets.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 font-display">2. Information We Collect</h2>
              <p>
                To provide our patient scheduling receptionist and practice automation services, we collect several types of data:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Clinic Profile & Admin Information:</strong> When a clinic registers, we collect clinic name, address, consultation fees, scheduling configurations, administrative email address, and login credentials.
                </li>
                <li>
                  <strong>Patient Information:</strong> When patients request or schedule appointments, we collect names, mobile numbers, email addresses, and medical/symptom notes provided during the booking flow.
                </li>
                <li>
                  <strong>Appointment Details:</strong> We log slot selection, status updates (confirmed, cancelled, pending), digital prescription records, and consultation histories.
                </li>
                <li>
                  <strong>Google Account & Calendar Integration Data:</strong> If you connect your Google Account, we request access to your Google Calendar to sync clinic appointments. We only read and write calendar events directly related to managing availability and bookings, and do not share this data with third parties.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 font-display">3. How We Use Google User Data</h2>
              <p>
                ClinicFlow's use and transfer to any other app of information received from Google APIs will adhere to the <strong>Google API Services User Data Policy</strong>, including the Limited Use requirements. We request permissions (scopes) solely to read your free/busy schedules and write confirmed client bookings into your selected calendar to prevent scheduling conflicts.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 font-display">4. Security Measures</h2>
              <p>
                We implement robust security measures, including HTTPS encryption, database access controls, hashed user passwords (using bcryptjs), and secure cookie-based session management, to prevent unauthorized access, alteration, disclosure, or destruction of your personal data.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 font-display">5. Data Retention</h2>
              <p>
                We retain your data for as long as your clinic account is active or as necessary to provide scheduling services. Patient appointment records are stored to assist clinics in maintaining patient history, but can be managed or deleted upon the clinic's or user's requests.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 font-display">6. Your Rights</h2>
              <p>
                You have the right to access, update, correct, or delete your personal details stored on ClinicFlow. You may also disconnect the Google Calendar OAuth integration at any time from your admin settings panel.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 font-display">7. Contact Information</h2>
              <p>
                If you have questions regarding this Privacy Policy or data processing practices, please contact us:
              </p>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-1.5 text-xs text-slate-700 font-medium">
                <div><strong>Business Name:</strong> ClinicFlow</div>
                <div><strong>Support Email:</strong> <a href="mailto:jha753430@gmail.com" className="text-primary hover:underline">jha753430@gmail.com</a></div>
                <div><strong>Support Phone:</strong> +91 8178141497</div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-white border-t border-slate-100 py-8 mt-auto">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500 font-medium">
          <div>
            © {new Date().getFullYear()} ClinicFlow. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy-policy">
              <span className="hover:text-primary transition-colors cursor-pointer">Privacy Policy</span>
            </Link>
            <Link href="/terms-and-conditions">
              <span className="hover:text-primary transition-colors cursor-pointer">Terms & Conditions</span>
            </Link>
            <Link href="/contact-us">
              <span className="hover:text-primary transition-colors cursor-pointer">Contact Us</span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
