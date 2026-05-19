import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./ProfileForm";

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
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Firma Profili</h1>
      <ProfileForm buyer={buyer} userId={user.id} />
    </div>
  );
}
