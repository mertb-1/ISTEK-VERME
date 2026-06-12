import { createClient } from "@/lib/supabase/server";
import ImportAnsweredWizard from "./ImportAnsweredWizard";

export const dynamic = "force-dynamic";

export default async function ImportAnsweredPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, company_name, contact_name, email")
    .eq("buyer_id", user!.id)
    .order("company_name");

  return <ImportAnsweredWizard suppliers={suppliers ?? []} />;
}
