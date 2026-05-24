# Teklif Platformu

Denizcilik sektörü için B2B teklif ve sipariş yönetim platformu. Alıcı ürün listesi oluşturur, sistem tedarikçilere otomatik e-posta gönderir, tedarikçiler kayıt olmadan magic link ile teklif verir, alıcı karşılaştırma tablosunda en iyi teklifi seçer ve sipariş oluşturur.

**Deploy:** https://teklif-platformu.vercel.app

---

## Başlarken

```bash
cd teklif-platformu
npm install
npm run dev        # localhost:3000
npm run build      # TypeScript + ESLint doğrulama
npm run lint       # ESLint
```

---

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Frontend + API | Next.js 14 App Router, TypeScript, Tailwind CSS |
| Veritabanı | Supabase PostgreSQL (RLS aktif) |
| Auth | Supabase Auth (sadece alıcılar) |
| E-posta | Resend — `lib/mail.ts` |
| Storage | Supabase Storage (`product-images`, `company-logos`) |
| Deploy | Vercel |

---

## Mimari Özeti

### Kullanıcı Rolleri

| Rol | Erişim |
|-----|--------|
| **Admin** | `admins` tablosunda kayıtlı Supabase Auth kullanıcısı; alıcı onaylama ve mail şablonu yönetimi |
| **Alıcı** | `buyers` tablosunda `approved` statüslü kullanıcı; RFQ oluşturma, teklif karşılaştırma, sipariş verme |
| **Tedarikçi** | Auth gerektirmez; `rfq_recipients.magic_token` ile `/quote/:token` sayfasına erişir |

### Uçtan Uca Veri Akışı

1. Alıcı `/rfq/new`'de teklif talebi (RFQ) oluşturur → `rfqs` + `rfq_items` + `rfq_recipients` kaydedilir
2. `POST /api/rfq/send` → tedarikçilere Resend ile HTML e-posta gönderilir
3. Tedarikçi magic link'e tıklar → `/quote/:token` → teklif formu → `POST /api/quote/submit`
4. `quotes` + `quote_items` eklenir; `rfq_recipients.status = responded`
5. Alıcıya bildirim maili gider
6. Alıcı `/rfq/:id`'de karşılaştırma tablosunu görür
7. Alıcı tek tedarikçi seçer → `POST /api/orders` → sipariş oluşturulur
   — VEYA —
   Karma sipariş (split-award) → `POST /api/orders/split-award` → her tedarikçi için ayrı sipariş
8. Award edilen tedarikçi(ler)e bildirim maili gider
9. `/quote/:token` artık `QuoteAwarded` (read-only) sayfasını gösterir

---

## Özellikler

### RFQ Oluşturma
- Manuel form (`/rfq/new`): başlık, son tarih, **para birimi (USD/EUR/TRY)**, notlar, ürün listesi, tedarikçi seçimi
- Excel yükleme wizard'ı (`/rfq/new/upload`): 3 adım — Yükle → Sütun eşleştirme → Ürün düzenleme; `/rfq/new`'e yönlendirme
- Yeni tedarikçi inline eklenebilir

### Teklif Formu (Tedarikçi)
- Kayıt gerektirmez, magic link yeterli
- Ürün başına birim fiyat, marka, stok durumu
- Toplam tutar dinamik hesaplanır, seçili para birimi sembolü ile gösterilir
- Deadline + 7 gün sonra link sona erer

### Karşılaştırma Tablosu
- Tedarikçi bazlı kolon düzeni
- En ucuz kalem yeşil vurgulanır
- "En Ucuz Karma" önerisi: her ürün için en ucuz tedarikçi
- Bekleyen (henüz cevap vermemiş) tedarikçiler ayrı kart
- Seçili tedarikçi için sipariş oluşturma dialogu

### Karma Sipariş (Split-Award)
- Farklı ürünleri farklı tedarikçilerden sipariş etme
- Fiyatlandırılmamış ürünler atlanabilir (amber uyarı)
- Her tedarikçi için ayrı `orders` kaydı oluşturulur
- Her tedarikçiye ayrı bildirim maili gönderilir

### Sipariş Yönetimi
- Alıcı `/orders/:id`'de sipariş detayını görür (tedarikçi, tutar, tarihler, kalemler)
- Sipariş durumu: `pending_confirmation / confirmed / completed / cancelled`

### Tedarikçiye Award Sayfası (`/quote/:token`)
- Award sonrası read-only onay sayfası
- Sipariş kalemleri tablosu: ürün, miktar, birim fiyat, toplam
- Para birimi tüm tutarlarda doğru gösterilir
- Teslim tarihi ve alıcı notu

### Çoklu Para Birimi (USD / EUR / TRY)
- RFQ oluşturulurken para birimi seçilir
- Seçim `rfqs.currency` → `quotes.currency` → `orders.currency` zinciriyle taşınır
- Client'tan gelen currency asla güvenilmez; her zaman sunucu tarafında RFQ'dan okunur
- `lib/currency.ts` paylaşılan utility: `formatMoney()`, `getCurrencySymbol()`, `SUPPORTED_CURRENCIES`
- Tedarikçi e-postalarında `{{para_birimi}}` değişkeni

### Mail Şablon Sistemi
- 4 şablon tipi: `supplier_rfq`, `buyer_notification`, `approval`, `supplier_order_notification`
- Admin panelinden düzenlenebilir (`/admin/mail-templates`)
- Değişken butonları, canlı önizleme
- Hizalama kontrolü (sol/orta/sağ) bölüm bazında
- Şablonlar `mail_templates` tablosunda saklanır; yoksa `MAIL_DEFAULTS` devreye girer

### White-Label
- `NEXT_PUBLIC_APP_NAME` env variable ile her firmaya farklı isimle deploy edilebilir
- Alıcı firma logosu topbar ve tedarikçi mail şablonlarında görünür

---

## Sayfa Yapısı

```
app/
├── (auth)/
│   ├── login/
│   ├── register/
│   └── beklemede/           # Onay bekleyen alıcı
├── (dashboard)/             # Middleware korumalı
│   ├── dashboard/
│   ├── rfq/
│   │   ├── [id]/            # RFQ detay + karşılaştırma tablosu
│   │   └── new/
│   │       ├── page.tsx     # Manuel RFQ oluşturma
│   │       └── upload/      # Excel yükleme wizard'ı
│   ├── orders/
│   │   └── [id]/            # Sipariş detay
│   ├── suppliers/
│   └── profile/
├── admin/
│   ├── buyers/              # Alıcı onaylama
│   └── mail-templates/      # Mail şablon editörü
├── quote/
│   └── [token]/             # Public — magic link
│       ├── page.tsx         # QuoteForm veya QuoteAwarded
│       ├── QuoteForm.tsx
│       ├── QuoteAwarded.tsx
│       ├── expired/
│       └── success/
└── api/
    ├── rfq/send/
    ├── rfq/parse-file/
    ├── quote/submit/
    ├── orders/
    │   ├── route.ts         # Tek tedarikçi siparişi
    │   └── split-award/     # Karma sipariş
    ├── admin/buyers/
    ├── admin/mail-templates/
    └── auth/check-role/
```

---

## Veritabanı Tabloları (Özet)

| Tablo | Kritik Alanlar |
|-------|----------------|
| `buyers` | `id`, `status`, `company_logo_url`, `company_email`, `company_phone` |
| `admins` | `id`, `email` |
| `suppliers` | `buyer_id`, `email`, `company_name`, `contact_name`, `category` |
| `rfqs` | `buyer_id`, `status`, `deadline`, `currency`, `awarded_recipient_id`, `split_awarded` |
| `rfq_items` | `rfq_id`, `order_no`, `product_name`, `quantity`, `unit`, `impa_code`, `photo_urls` |
| `rfq_recipients` | `rfq_id`, `supplier_id`, `magic_token`, `status`, `awarded_at`, `order_id` |
| `quotes` | `rfq_recipient_id`, `total_amount`, `currency`, `delivery_time`, `payment_terms` |
| `quote_items` | `quote_id`, `rfq_item_id`, `unit_price`, `total_price`, `offered_brand`, `in_stock` |
| `orders` | `rfq_id`, `rfq_recipient_id`, `buyer_id`, `status`, `confirmed_amount`, `currency`, `expected_delivery`, `buyer_note` |
| `order_items` | `order_id`, `rfq_item_id`, `confirmed_unit_price`, `confirmed_quantity`, `confirmed_brand` |
| `mail_templates` | `type`, `subject`, `greeting`, `body`, `signature`, `is_active` |

---

## Önemli Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `lib/config.ts` | `APP_NAME` white-label sabiti, `DEFAULT_CURRENCY` |
| `lib/currency.ts` | `formatMoney()`, `getCurrencySymbol()`, `SUPPORTED_CURRENCIES` |
| `lib/mail.ts` | Resend HTML mail altyapısı |
| `lib/mail-defaults.ts` | Şablon tipleri, varsayılan içerikler, değişken listeleri |
| `components/Sidebar.tsx` | Hamburger drawer + topbar |
| `components/PhotoUploader.tsx` | Fotoğraf sıkıştırma + Supabase Storage yükleme |
| `app/(dashboard)/rfq/[id]/RfqDetail.tsx` | Karşılaştırma tablosu + award/split-award dialog |
| `app/quote/[token]/QuoteForm.tsx` | Tedarikçi teklif formu |
| `app/quote/[token]/QuoteAwarded.tsx` | Award sonrası read-only sayfası |
| `app/api/orders/route.ts` | Tek tedarikçi sipariş oluşturma |
| `app/api/orders/split-award/route.ts` | Karma sipariş oluşturma |

---

## Güvenlik

- RLS tüm tablolarda aktif
- Tüm UUID'ler `isUuid()` ile doğrulanır
- `lib/mail.ts`'deki `esc()` tüm kullanıcı girdilerini HTML escape eder
- `confirmed_amount` client'tan alınmaz; sunucu tarafında `quote.total_amount`'tan kopyalanır
- `currency` client'tan alınmaz; sunucu tarafında `rfqs.currency`'den okunur
- `buyer_note` / `confirmation_note` 2000 karaktere kırpılır
- `orders` tablosunda `UNIQUE INDEX WHERE status != 'cancelled'` — çift aktif sipariş DB'de engellenir
- Storage RLS: `company-logos` bucket'ta `auth.uid()::text = (storage.foldername(name))[1]`
