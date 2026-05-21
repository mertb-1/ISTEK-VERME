# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proje Özeti

Denizcilik sektörü B2B teklif platformu. Alıcı ürün listesi yazar → sistem tedarikçilere otomatik Resend maili atar → tedarikçiler magic link ile kayıtsız cevap verir → alıcı karşılaştırma tablosunda görür → sipariş oluşturulur → tedarikçiye bildirim maili gider.

White-label yapıya sahip: `NEXT_PUBLIC_APP_NAME` env variable ile her firmaya farklı isimle deploy edilebilir.

## Komutlar

```bash
cd teklif-platformu
npm run dev      # Geliştirme sunucusu (localhost:3000)
npm run build    # Production build — TypeScript + ESLint hataları burada çıkar
npm run lint     # ESLint
```

## Stack

- **Frontend + API:** Next.js 14 App Router, TypeScript, Tailwind CSS
- **Veritabanı:** Supabase PostgreSQL (proje ID: `rfjdzutefamucwyfxgvq`)
- **Auth:** Supabase Auth (sadece alıcılar için; tedarikçiler kayıt olmaz)
- **Mail:** Resend (`lib/mail.ts`, `from: onboarding@resend.dev` — test modunda sadece hesap sahibi adresine gönderilebilir)
- **Storage:** Supabase Storage — `product-images` bucket (ürün fotoğrafları), `company-logos` bucket (firma logoları); ikisi de public read
- **Görsel sıkıştırma:** `browser-image-compression` — `PhotoUploader` bileşeninde kullanılır
- **Toast:** `sonner` — `app/layout.tsx`'de `<Toaster />` mount edilmiş; `import { toast } from "sonner"` ile kullan
- **Deploy:** Vercel — `https://teklif-platformu.vercel.app`

## Mimari

### White-Label Yapısı

Uygulama adı `lib/config.ts`'deki `APP_NAME` sabiti üzerinden okunur:

```ts
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "GetYourQuote";
```

Tüm bileşenler ve `lib/mail.ts` bu sabiti import eder.

### Supabase Client Katmanları

| Dosya | Ne zaman kullanılır |
|-------|---------------------|
| `lib/supabase/client.ts` | `"use client"` bileşenler (browser) |
| `lib/supabase/server.ts` | Server Components, API Route'lar (cookie tabanlı session) |
| `lib/supabase/admin.ts` | RLS'i bypass etmesi gereken admin işlemleri (service role key) |

RLS sorunlarında veya nested Supabase join'larında `createAdminClient()` kullan. Özellikle `/rfq/[id]/page.tsx`'de tüm veri admin client ile çekilir.

**Önemli:** `/quote/[token]/page.tsx` gibi sipariş durumunun taze gelmesi gereken sayfalarda `noStore()` (`next/cache`) çağır — App Router Supabase fetch sonuçlarını cache'leyebilir ve `awarded_at=null` olan eski veriyi döndürebilir.

### Kullanıcı Rolleri ve Auth Akışı

- **Admin:** `admins` tablosunda kaydı olan Supabase Auth kullanıcısı. Login'de `check-role` API'si `/admin/buyers`'a yönlendirir.
- **Alıcı:** `buyers` tablosunda `status: pending/approved/rejected`. `pending` iken `/beklemede`'ye yönlenir. Sadece `approved` alıcılar sistemi kullanabilir.
- **Tedarikçi:** Supabase Auth'a kayıt olmaz. `rfq_recipients.magic_token` (UUID) ile `/quote/:token` sayfasına erişir.

**Middleware** (`middleware.ts`): `/dashboard`, `/rfq`, `/suppliers`, `/profile`, `/orders` path'lerini korur. `/quote/*` middleware dışında tutulur (public).

**Dashboard layout** (`app/(dashboard)/layout.tsx`): buyer'ın `status=approved` olduğunu kontrol eder; değilse `/beklemede`'ye yönlendirir. `Sidebar`'a `full_name, company_name, company_logo_url` geçer.

### Veri Akışı

1. Alıcı `/rfq/new`'de RFQ oluşturur → `rfqs` + `rfq_items` + `rfq_recipients` (status=`sent`) insert edilir
2. `POST /api/rfq/send` → her tedarikçiye Resend ile HTML mail gönderir (`buyerCompany via APP_NAME`, `reply-to: company_email`), `sent_at` güncellenir
3. Tedarikçi magic link'e tıklar → `/quote/:token` → `QuoteForm` → `POST /api/quote/submit`
4. Submit: `quotes` + `quote_items` insert, `rfq_recipients.status = responded`
5. Alıcı `/rfq/:id`'de karşılaştırma tablosunu görür
6. Alıcı tedarikçiyi seçer → onay dialogu → `POST /api/orders` → `orders` + `order_items` insert
7. `rfq_recipients.awarded_at` + `order_id` güncellenir; `rfqs.awarded_recipient_id` + `status=closed` güncellenir
8. Award edilen tedarikçiye `supplier_order_notification` şablonuyla bildirim maili gider
9. Alıcı `/orders/:id`'de sipariş detayını görür
10. Award sonrası `/quote/:token` → `QuoteAwarded` (read-only); form gösterilmez

### Excel Yükleme Akışı (`/rfq/new/upload`)

3 adımlı wizard: **Yükle → Sütunlar → Ürünler**

- `lib/rfq-parse/excel-parser.ts` — XLSX parse, başlık satırı tespiti (merged cell desteği dahil)
- `lib/rfq-parse/keywords.ts` — sütun eşleştirme (`FIELD_KEYWORDS`), `HIDDEN_COLUMN_KEYWORDS` (NO, sıra no vb. UI'da gizlenir), `price` veya `ignore` atanan sütunlar da gizlenir
- `lib/rfq-parse/keywords.ts` → `applyFieldMap()` — sütun map'i uygulayarak `ParsedItem[]` üretir
- API route: `POST /api/rfq/parse-file` — sunucuda XLSX okur, `ExcelApiResponse` döner
- Wizard sonucu `localStorage`'a (`rfq_upload_items`) yazılır; `/rfq/new?source=upload` açılınca okunur

### Navigasyon

- **Masaüstü + Mobil:** Hamburger butonu (topbar'da) → slide-in drawer (`components/Sidebar.tsx`)
- Topbar'da: `company_logo_url` varsa firma logosu gösterilir; yoksa firma adının baş harf avatarı + `company_name` yazısı
- Dashboard layout tüm ekranlarda `pt-14` uygular (topbar yüksekliği)
- Route değişince drawer otomatik kapanır

## Mail Şablon Sistemi

Tüm mailler veritabanı tabanlı, admin panelinden düzenlenebilir. Şablonlar `mail_templates` tablosunda saklanır.

### Şablon Tipleri

| Tip | Tetikleyen |
|-----|-----------|
| `supplier_rfq` | Alıcı RFQ gönderdiğinde tedarikçiye |
| `buyer_notification` | Tedarikçi teklif verdiğinde alıcıya |
| `approval` | Admin alıcıyı onayladığında |
| `supplier_order_notification` | Alıcı siparişi onayladığında award edilen tedarikçiye |

### Mail Altyapısı

- `lib/mail-defaults.ts` — Tip tanımları (`MailTemplateType`), her tip için varsayılan içerik ve admin editördeki değişken butonları (`VARS`)
- `lib/mail.ts` — `getMailTemplate()`, `replaceVars()`, `buildMailHtml()`, `sendRfqMail()`, `sendSimpleMail()`
- Admin editör: `/admin/mail-templates` — 4 sekme, inline önizleme, değişken buton ekleme
- Yeni tip eklerken güncellenmesi gereken 4 yer: `MailTemplateType` union, `MAIL_DEFAULTS`, `VALID_TYPES` (API route), `MailTemplateEditor` (TAB_LABELS + TAB_ORDER + VARS + buildPreviewHtml buttonLabel)

## Veritabanı Tabloları

| Tablo | Kritik Alanlar |
|-------|----------------|
| `buyers` | `id` (= auth.uid()), `status: pending/approved/rejected`, `company_logo_url` (VARCHAR nullable), `company_email` (VARCHAR nullable), `company_phone` (VARCHAR nullable), `company_address` (TEXT nullable) |
| `admins` | `id` (= auth.uid()), `email` |
| `suppliers` | `buyer_id` (alıcıya ait), `email`, `category`, `company_name`, `contact_name` |
| `rfqs` | `buyer_id`, `status: open/closed`, `deadline`, `awarded_recipient_id` (UUID nullable → rfq_recipients) |
| `rfq_items` | `rfq_id`, `order_no`, `product_name`, `brand`, `quantity`, `unit`, `impa_code` (VARCHAR nullable), `detailed_description` (TEXT nullable), `photo_urls` (TEXT[] nullable) |
| `rfq_recipients` | `rfq_id`, `supplier_id`, `magic_token` (UUID unique), `status: sent/responded`, `sent_at`, `responded_at`, `awarded_at` (TIMESTAMPTZ nullable), `order_id` (UUID nullable → orders) |
| `quotes` | `rfq_recipient_id`, `total_amount`, `delivery_time`, `payment_terms` |
| `quote_items` | `quote_id`, `rfq_item_id`, `unit_price`, `total_price`, `offered_brand`, `in_stock` |
| `orders` | `rfq_id`, `rfq_recipient_id`, `quote_id`, `buyer_id`, `status: pending_confirmation/confirmed/completed/cancelled`, `confirmed_amount`, `expected_delivery` (DATE), `buyer_note`, `confirmation_note`, `created_at`, `confirmed_at`, `cancelled_at`, `completed_at` |
| `order_items` | `order_id`, `rfq_item_id`, `quote_item_id` (nullable), `confirmed_unit_price`, `confirmed_quantity`, `confirmed_brand` |
| `mail_templates` | `type` (CHECK constraint), `subject`, `greeting`, `greeting_align`, `body`, `body_align`, `signature`, `signature_align`, `is_active`, `updated_at`, `updated_by` |

## API Route'ları

| Route | Açıklama |
|-------|----------|
| `POST /api/rfq/send` | RFQ'yu tedarikçilere mail ile gönderir |
| `POST /api/rfq/parse-file` | Excel dosyasını parse eder |
| `POST /api/quote/submit` | Tedarikçi teklifini kaydeder (token ile, auth gereksiz) |
| `POST /api/orders` | Seçilen tekliften sipariş oluşturur; award maili gönderir |
| `GET /api/admin/buyers` | Admin: alıcı listesi |
| `PATCH /api/admin/buyers` | Admin: alıcı durum güncelleme |
| `GET /api/auth/check-role` | Login sonrası rol tespiti |
| `GET /api/admin/mail-templates` | Admin: şablon listesi |
| `PATCH /api/admin/mail-templates` | Admin: şablon güncelleme |

## Güvenlik

- RLS tüm tablolarda aktif
- API route'larında gelen tüm UUID'ler `isUuid()` ile doğrulanır (`lib/utils.ts`)
- `lib/mail.ts`'deki `esc()` fonksiyonu HTML mail'deki tüm kullanıcı girdilerini escape eder
- `quote/submit` route'unda `ALLOWED_ITEM_KEYS` allowlist ile sadece izin verilen alanlar yazılır
- `new Resend()` build sırasında çalışmaması için `sendRfqMail()` içinde lazy init edilir
- `/quote/:token` sayfası public — auth gerektirmez; token süresi deadline + 7 gün
- Storage RLS: `company-logos` bucket'ta `auth.uid()::text = (storage.foldername(name))[1]`
- `POST /api/orders`: `confirmed_amount` sunucu tarafında `quote.total_amount`'tan kopyalanır. `buyer_note` / `confirmation_note` 2000 karaktere kırpılır.
- `orders` tablosunda `UNIQUE INDEX WHERE status != 'cancelled'` — aynı `rfq_recipient_id` için birden fazla aktif sipariş DB seviyesinde engellenir.

## Sayfa Yapısı

```
/login, /register, /beklemede     → app/(auth) route grubu
/dashboard, /rfq, /suppliers,
/profile, /orders                 → app/(dashboard) route grubu — middleware korumalı
/admin/buyers                     → middleware dışı, requireAdmin() ile korumalı
/admin/mail-templates             → admin mail şablon editörü
/quote/[token]                    → public, magic link sayfası
/rfq/new/upload                   → Excel yükleme wizard'ı
```

## Önemli Dosyalar

- `lib/config.ts` — `APP_NAME` white-label sabiti
- `lib/mail.ts` — Resend HTML mail altyapısı
- `lib/mail-defaults.ts` — Şablon tipleri, varsayılanlar, değişken listeleri
- `components/Sidebar.tsx` — Hamburger drawer + topbar
- `components/PhotoUploader.tsx` — Fotoğraf sıkıştır → Supabase Storage'a yükle
- `app/(dashboard)/rfq/new/page.tsx` — RFQ oluşturma formu
- `app/(dashboard)/rfq/new/upload/page.tsx` — Excel yükleme wizard'ı
- `app/(dashboard)/profile/page.tsx` + `ProfileForm.tsx` — Firma logosu yükleme + bilgi formu
- `app/quote/[token]/page.tsx` — Magic link sayfası; `noStore()` ile cache'i devre dışı bırakır
- `app/quote/[token]/QuoteForm.tsx` — Tedarikçi teklif formu (editable)
- `app/quote/[token]/QuoteAwarded.tsx` — Award sonrası read-only onay sayfası
- `app/(dashboard)/rfq/[id]/RfqDetail.tsx` — Karşılaştırma tablosu + award dialog
- `app/(dashboard)/orders/[id]/page.tsx` — Sipariş detay sayfası (read-only)
- `app/api/orders/route.ts` — Sipariş oluşturma; award maili gönderme
- `app/admin/mail-templates/MailTemplateEditor.tsx` — 4 sekmeli mail şablon editörü

## Kritik Pitfall'lar

- **İç içe form yasak:** `rfq/new/page.tsx` bir `<form>` içinde. Alt bileşenlerde `<form>` açma — `<div>` + `type="button"` kullan.
- **Supabase join + RLS:** Nested join (`rfqs(buyers(...))`) bazen RLS'den dolayı boş döner. `createAdminClient()` kullan.
- **`Set` spread:** `tsconfig.json`'da `target` düşükse `new Set([...prev, id])` derlenmez. `const next = new Set(prev); next.add(id); return next;` kullan.
- **Miktar input'u:** `type="number"` input'larda `step="any"` kullan; `step="0.01"` browser'ın floating-point step doğrulaması nedeniyle değeri değiştirebilir (örn. 45 → 44.97).
- **Order circular FK:** `orders` → `rfq_recipients` ve `rfq_recipients.order_id` → `orders`. Runtime'da: önce `orders` INSERT, sonra `rfq_recipients` UPDATE.
- **Supabase join dizi tipi:** `rfq_items` TypeScript'te dizi olarak gelir. `Array.isArray(raw) ? raw[0] : raw` kullan.
- **PostgREST ambiguous FK (ÇOK KRİTİK):** `rfqs.awarded_recipient_id → rfq_recipients` ve `rfq_recipients.rfq_id → rfqs` aynı anda var olduğundan `rfqs(...)` join'ında explicit FK hint zorunlu: `rfqs!rfq_recipients_rfq_id_fkey(...)`. `app/quote/[token]/page.tsx` ve `app/api/quote/submit/route.ts` içinde uygulandı.
- **Next.js fetch cache:** Server Component'larda Supabase sorguları cache'lenebilir. Durumun taze gelmesi gereken sayfalarda (örn. `awarded_at` kontrolü) `noStore()` çağır.
- **Mail hataları siparişi etkilememeli:** `api/orders/route.ts`'deki mail gönderimi `try/catch` içinde olup hata yalnızca `console.error` ile loglanır; sipariş rollback edilmez.
