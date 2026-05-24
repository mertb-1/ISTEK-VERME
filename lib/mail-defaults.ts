export type MailTemplateType = "supplier_rfq" | "buyer_notification" | "approval" | "supplier_order_notification";

export type MailTemplate = {
  type: MailTemplateType;
  subject: string;
  greeting: string;
  body: string;
  signature: string;
};

export const MAIL_DEFAULTS: Record<MailTemplateType, MailTemplate> = {
  supplier_rfq: {
    type: "supplier_rfq",
    subject: "Teklif Talebi - {{gemi_adi}} / {{teklif_tarihi}}",
    greeting: "Sayın Yetkili,",
    body: "{{firma_adi}} adına aşağıdaki ürünler için teklif talebinde bulunuyoruz.\n\nTekliflerinizi {{son_tarih}} tarihine kadar iletmenizi rica ederiz.\n\nNot: {{teklif_notu}}",
    signature:
      "Saygılarımızla,\n{{yetkili_adi}}\n{{firma_adi}}\nTel: {{firma_telefon}}\nMail: {{firma_mail}}",
  },
  buyer_notification: {
    type: "buyer_notification",
    subject: "Teklif Cevabı Geldi - {{teklif_no}}",
    greeting: "Sayın {{alici_adi}},",
    body: "{{tedarikci_adi}} firması {{teklif_no}} numaralı teklifinize {{cevap_tarihi}} tarihinde cevap verdi.\n\nTeklifleri karşılaştırmak için aşağıdaki butona tıklayın.",
    signature: "{{firma_adi}} Teklif Platformu",
  },
  approval: {
    type: "approval",
    subject: "Hesabınız Onaylandı - {{firma_adi}}",
    greeting: "Sayın {{alici_adi}},",
    body: "{{firma_adi}} teklif platformuna üyeliğiniz onaylandı.\n\nArtık sisteme giriş yapabilirsiniz.",
    signature: "{{firma_adi}} Teklif Platformu",
  },
  supplier_order_notification: {
    type: "supplier_order_notification",
    subject: "{{firma_adi}} — Siparişiniz Onaylandı (#{{siparis_no}})",
    greeting: "Sayın {{tedarikci_adi}},",
    body: "{{firma_adi}} firması, {{teklif_no}} numaralı teklif talebinize verdiğiniz teklifi sipariş olarak onaylamıştır.\n\nSipariş No: {{siparis_no}}\nSipariş Tutarı: {{siparis_tutari}} {{para_birimi}}\nTahmini Teslim Tarihi: {{teslim_tarihi}}\n\n{{siparis_notu}}\n\nSipariş detaylarını incelemek için lütfen aşağıdaki bağlantıya tıklayın.",
    signature:
      "Saygılarımızla,\n{{firma_adi}}\nTel: {{firma_telefon}}\nMail: {{firma_mail}}",
  },
};
