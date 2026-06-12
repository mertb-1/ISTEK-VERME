import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import ImportQuoteWizard from "./ImportQuoteWizard";

export const dynamic = "force-dynamic";

export default async function ImportQuotePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: rfq } = await supabase
    .from("rfqs")
    .select("id, title, status, currency, awarded_recipient_id, split_awarded")
    .eq("id", params.id)
    .eq("buyer_id", user!.id)
    .single();

  if (!rfq) notFound();

  const closed = rfq.status !== "open" || rfq.awarded_recipient_id || rfq.split_awarded;

  if (closed) {
    return (
      <div className="w-full max-w-[1440px] mx-auto px-4 lg:px-8 py-6 lg:py-8">
        <div
          className="flex items-start gap-3 max-w-xl px-5 py-4 rounded-2xl"
          style={{ background: "#fdf0ee", border: "1px solid #f0cec6" }}
        >
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#8b3a2a" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "#8b3a2a" }}>
              Bu teklif talebi kapatılmış
            </p>
            <p className="text-sm mt-1" style={{ color: "#7a6e67" }}>
              Kapatılmış veya sipariş verilmiş bir teklif talebine teklif içe aktarılamaz.
            </p>
            <Link
              href={`/rfq/${rfq.id}`}
              className="inline-block mt-3 text-sm font-semibold hover:underline"
              style={{ color: "#8b3a2a" }}
            >
              Karşılaştırma tablosuna dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { data: items } = await supabase
    .from("rfq_items")
    .select("id, order_no, product_name, brand, quantity, unit, impa_code")
    .eq("rfq_id", rfq.id)
    .order("order_no");

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, company_name, contact_name, email")
    .eq("buyer_id", user!.id)
    .order("company_name");

  // Hangi tedarikçinin bu RFQ'da zaten teklifi var? (admin — nested join RLS'de boş dönebilir)
  const admin = createAdminClient();
  const { data: recipients } = await admin
    .from("rfq_recipients")
    .select("id, supplier_id, quotes(id)")
    .eq("rfq_id", rfq.id);

  const quotedSupplierIds = new Set<string>();
  for (const r of recipients ?? []) {
    const quotes = Array.isArray(r.quotes) ? r.quotes : r.quotes ? [r.quotes] : [];
    if (quotes.length > 0) quotedSupplierIds.add(r.supplier_id);
  }

  return (
    <ImportQuoteWizard
      rfq={{ id: rfq.id, title: rfq.title, currency: rfq.currency ?? "USD" }}
      items={items ?? []}
      suppliers={(suppliers ?? []).map((s) => ({
        ...s,
        hasQuote: quotedSupplierIds.has(s.id),
      }))}
    />
  );
}
