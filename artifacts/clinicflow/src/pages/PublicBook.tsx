import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useListClinics } from "@workspace/api-client-react";
import { Loader2, ShieldAlert } from "lucide-react";

const getClinicSlug = (name: string) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export default function PublicBook() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { data: clinics, isLoading } = useListClinics();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !clinics || !slug) return;

    const clinic = clinics.find((c) => getClinicSlug(c.name) === slug);

    if (!clinic) {
      setError("Clinic not found. Please verify the booking link.");
      return;
    }

    // Call API to get a chat token for this clinic
    const fetchTokenAndRedirect = async () => {
      try {
        const res = await fetch(`/api/clinics/${clinic.id}/chat/token`, {
          method: "POST",
        });

        if (!res.ok) {
          throw new Error("Failed to generate booking session token");
        }

        const data = (await res.json()) as { token: string };
        
        // Redirect to chat page with the generated token
        setLocation(`/chat/${clinic.id}?token=${data.token}`);
      } catch (err: any) {
        console.error(err);
        setError("Unable to initialize booking session. Please try again.");
      }
    };

    fetchTokenAndRedirect();
  }, [clinics, isLoading, slug, setLocation]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Booking Error</h1>
          <p className="text-gray-500 mb-6">{error}</p>
          <a
            href="/"
            className="inline-block bg-primary text-white font-medium px-6 py-2.5 rounded-full text-sm hover:opacity-90 transition-opacity"
          >
            Go to Homepage
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="text-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
        <h2 className="text-lg font-semibold text-gray-800">Initializing your booking assistant...</h2>
        <p className="text-xs text-gray-500">Connecting to clinic receptionist...</p>
      </div>
    </div>
  );
}
