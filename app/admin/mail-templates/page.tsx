import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MailTemplateEditor from "./MailTemplateEditor";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("admins")
    .select("id")
    .eq("id", user.id)
    .single();
  return data ? user : null;
}

export default async function MailTemplatesPage() {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  const adminClient = createAdminClient();
  const { data: templates } = await adminClient
    .from("mail_templates")
    .select("type, subject, greeting, body, signature")
    .order("type");

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mail Şablonları</h1>
          <p className="text-gray-500 mt-1">
            Sisteminizin gönderdiği maillerin içeriklerini düzenleyin.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <MailTemplateEditor initial={templates ?? []} />
        </div>
      </div>
    </div>
  );
}
