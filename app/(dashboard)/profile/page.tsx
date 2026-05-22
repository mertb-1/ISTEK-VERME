import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./ProfileForm";
import { User } from "lucide-react";

export default async function ProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: buyer } = await supabase
    .from("buyers")
    .select("full_name, company_name, company_logo_url, company_email, company_phone, company_address")
    .eq("id", user.id)
    .single();

  if (!buyer) redirect("/beklemede");

  return (
    <div style={{ background: "#faf4ee", minHeight: "100vh" }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#f0e9e2" }}
          >
            <User className="w-5 h-5" style={{ color: "#8b3a2a" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#111", letterSpacing: "-0.02em" }}>
              Firma Profili
            </h1>
            <p className="text-sm" style={{ color: "#7a6e67" }}>
              Firma bilgilerinizi ve logonuzu güncelleyin
            </p>
          </div>
        </div>

        <ProfileForm buyer={buyer} userId={user.id} />
      </div>
    </div>
  );
}
