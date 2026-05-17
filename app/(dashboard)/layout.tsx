import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: buyer } = await supabase
    .from("buyers")
    .select("status, full_name, company_name")
    .eq("id", user.id)
    .single();

  if (!buyer || buyer.status !== "approved") redirect("/beklemede");

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar buyer={buyer} />
      <main className="pt-14 min-h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
