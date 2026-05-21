-- Add supplier_order_notification to mail_templates type constraint (if it exists)
DO $$
BEGIN
  ALTER TABLE mail_templates
    DROP CONSTRAINT IF EXISTS mail_templates_type_check;

  ALTER TABLE mail_templates
    ADD CONSTRAINT mail_templates_type_check
    CHECK (type IN ('supplier_rfq', 'buyer_notification', 'approval', 'supplier_order_notification'));
EXCEPTION
  WHEN undefined_table THEN NULL;
END;
$$;

-- Insert default template; skip if already exists
INSERT INTO mail_templates (type, subject, greeting, greeting_align, body, body_align, signature, signature_align, is_active)
VALUES (
  'supplier_order_notification',
  '{{firma_adi}} — Siparişiniz Onaylandı (#{{siparis_no}})',
  'Sayın {{tedarikci_adi}},',
  'left',
  '{{firma_adi}} firması, {{teklif_no}} numaralı teklif talebinize verdiğiniz teklifi sipariş olarak onaylamıştır.' || E'\n\n' ||
  'Sipariş No: {{siparis_no}}' || E'\n' ||
  'Sipariş Tutarı: {{siparis_tutari}}' || E'\n' ||
  'Tahmini Teslim Tarihi: {{teslim_tarihi}}' || E'\n\n' ||
  '{{siparis_notu}}' || E'\n\n' ||
  'Sipariş detaylarını incelemek için lütfen aşağıdaki bağlantıya tıklayın.',
  'left',
  E'Saygılarımızla,\n{{firma_adi}}\nTel: {{firma_telefon}}\nMail: {{firma_mail}}',
  'left',
  true
)
ON CONFLICT DO NOTHING;
