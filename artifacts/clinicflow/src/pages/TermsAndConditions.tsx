import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

export default function TermsAndConditions() {
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
              <FileText className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-display">
                Terms & Conditions
              </h1>
              <p className="text-xs text-slate-400 mt-1">Last Updated: June 24, 2026</p>
            </div>
          </div>

          <div className="prose prose-slate max-w-none text-xs sm:text-sm text-slate-650 leading-relaxed space-y-6">
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 font-display">1. Agreement to Terms</h2>
              <p>
                By registering an account and using the <strong>ClinicFlow</strong> software-as-a-service platform, clinic booking widgets, and related APIs, you agree to comply with and be bound by these Terms & Conditions. If you disagree with any part of these terms, please do not access or use our services.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 font-display">2. Use of Platform & User Responsibilities</h2>
              <p>
                Clinics are authorized to use the platform to manage profiles, appointments, patient lists, and digital prescriptions. You are responsible for:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Maintaining the confidentiality of your clinic login credentials.</li>
                <li>Obtaining required consent from patient clients before logging their records or symptoms.</li>
                <li>Ensuring all clinical guidelines and professional compliance requirements are met in your region.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 font-display">3. Subscription & Payments</h2>
              <p>
                Access to certain advanced features is granted on a subscription basis. Subscriptions are billed monthly, quarterly, or yearly.
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong>Billing cycles:</strong> Managed through your clinic account settings.</li>
                <li><strong>Payment verification:</strong> Requires manual/automatic verification by the system owner.</li>
                <li><strong>Failure to renew:</strong> May lead to account expiration or temporary suspension of patient scheduling services.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 font-display">4. Account & Data Ownership</h2>
              <p>
                You retain all rights and ownership of the clinical data, scheduling preferences, and patient records you input into ClinicFlow. ClinicFlow owns the software platform, design elements, algorithms, and intellectual property. We do not sell or monetize your clinical records.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 font-display">5. Service Limitations & Disclaimers</h2>
              <p>
                ClinicFlow is an operations coordination tool and does <strong>not</strong> provide medical advice or emergency medical services. In the event of system downtime or calendar sync lag, we do not assume liability for scheduling inconveniences. Services are provided on an "as is" and "as available" basis.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 font-display">6. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, ClinicFlow and its owners shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, arising out of your use or inability to use the platform.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 font-display">7. Termination</h2>
              <p>
                We reserve the right to suspend or terminate your account access immediately, without prior notice, if you violate these Terms or engage in activities that could harm our platform, other clinics, or patients.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 font-display">8. Contact Information</h2>
              <p>
                If you have questions regarding these Terms & Conditions, please contact our support team:
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
