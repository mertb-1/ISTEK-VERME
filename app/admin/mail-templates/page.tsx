import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MailTemplateEditor from "./MailTemplateEditor";
import { Mail } from "lucide-react";

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
    .select("type, subject, greeting, greeting_align, body, body_align, signature, signature_align")
    .order("type");

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#f0e9e2" }}
          >
            <Mail className="w-5 h-5" style={{ color: "#8b3a2a" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#111", letterSpacing: "-0.02em" }}>
              Mail Şablonları
            </h1>
            <p className="text-sm" style={{ color: "#7a6e67" }}>
              Sisteminizin gönderdiği maillerin içeriklerini düzenleyin
            </p>
          </div>
        </div>

        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid #e6ddd4", background: "#fff" }}
        >
          <MailTemplateEditor initial={templates ?? []} />
        </div>
      </div>
    </div>
  );
}
