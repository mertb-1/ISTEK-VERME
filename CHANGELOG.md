# Changelog

Tüm önemli değişiklikler bu dosyada belgelenmiştir.

---

## [Yayınlanmamış] — 2026-05-24

### Eklendi — Çoklu Para Birimi (USD / EUR / TRY)

**Phase 1 — Veritabanı + Paylaşılan Utility** (`c179d0f`)
- `rfqs`, `quotes`, `orders` tablolarına `currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'TRY'))` kolonu eklendi (Supabase migration)
- `lib/currency.ts` dosyası oluşturuldu:
  - `SUPPORTED_CURRENCIES = ["USD", "EUR", "TRY"]` sabiti
  - `Currency` discriminated union tipi
  - `CURRENCY_LABELS` — `{ USD: "USD ($)", EUR: "EUR (€)", TRY: "TRY (₺)" }`
  - `getCurrencySymbol(currency)` — para birimi sembolü döner
  - `formatMoney(amount, currency)` — `Intl.NumberFormat("tr-TR", { style: "currency" })` ile formatlar; `null`/`undefined` → `"—"`
- `lib/config.ts`'e `DEFAULT_CURRENCY = "USD"` eklendi

**Phase 2 — Backend Veri Akışı** (`f40e6d3`)
- `POST /api/quote/submit`: RFQ'dan currency okunur, `quotes` insert'ine yazılır (client payload'dan asla alınmaz)
- `POST /api/orders`: RFQ'dan currency okunur, `orders` insert'ine yazılır
- `POST /api/orders/split-award`: aynı güvenli pattern, her sipariş insert'ine `currency` dahil edilir

**Phase 3 — Okuma Tarafı UI Formatlaması** (`1ad5c3a`)
- Tüm bileşenlerdeki hardcoded `"USD"` ve yerel `formatPrice` fonksiyonları `formatMoney(amount, currency)` ile değiştirildi:
  - `RfqDetail.tsx` — karşılaştırma tablosundaki tüm fiyatlar
  - `orders/[id]/page.tsx` — sipariş detay sayfası
  - `QuoteAwarded.tsx` — award read-only sayfası
  - `QuoteForm.tsx` — tedarikçi teklif formu (sütun başlığında sembol, toplam formatında)
  - `quote/[token]/page.tsx` — currency RFQ join'ından ve orders sorgusundan çekilip child bileşenlere paslanır
- `page.tsx`'de RFQ join sorgusu `currency` alanını içerecek şekilde güncellendi: `rfqs!rfq_recipients_rfq_id_fkey(id, title, notes, deadline, currency, buyers(...))`

**Phase 4 — RFQ Oluşturma Para Birimi Seçici** (`d8121b0`)
- `rfq/new/page.tsx`'e para birimi `<select>` eklendi — "Teklif Bilgileri" bölümünde son tarih ile notlar arasında, 3 kolonlu grid
- Seçenekler `SUPPORTED_CURRENCIES` + `CURRENCY_LABELS`'tan dinamik üretilir; varsayılan `"USD"`
- Submit'te `safeCurrency` kontrolü yapılır; geçersiz değer `"USD"`'ye düşer
- Hem manuel hem Excel upload akışı bu sayfadan geçtiği için ayrıca upload wizard'da değişiklik gerekmedi

**Phase 5 — E-posta Para Birimi Değişkeni** (`d8121b0`)
- `lib/mail-defaults.ts` — `supplier_order_notification` varsayılan body güncellendi: `Sipariş Tutarı: {{siparis_tutari}} {{para_birimi}}`
- `MailTemplateEditor.tsx` — `supplier_order_notification` VARS body listesine `{{para_birimi}}` eklendi; `PREVIEW_DATA`'da `siparis_tutari: "12.500,00"` ve `para_birimi: "USD"` ayrı tutuldu
- `api/orders/route.ts` — mail vars'a `para_birimi: orderCurrency` eklendi
- `api/orders/split-award/route.ts` — aynı, her tedarikçi mail döngüsünde `para_birimi: orderCurrency`

---

## Karma Sipariş (Split-Award) — 2026-05 öncesi

### Eklendi (`2ce94e6`, `ea0b3ff`, `0052c11`, `d8b6dc3`, `3155ac9`, `3b3ccc8`)
- "En Ucuz Karma" butonundan split-award dialog açılır
- Her ürün için farklı tedarikçi seçilebilir; aynı tedarikçiden alınan ürünler tek sipariş altında gruplanır
- Fiyatlandırılmamış ürünler atlanabilir — amber uyarı gösterilir
- `POST /api/orders/split-award` route oluşturuldu:
  - Her benzersiz tedarikçi için `orders` INSERT
  - Her siparişe ait `order_items` INSERT
  - Her `rfq_recipients` kaydı `awarded_at + order_id` ile güncellenir
  - `rfqs.split_awarded = true` + `rfqs.status = closed`
  - Her tedarikçiye ayrı bildirim maili
- Çift award DB-level UNIQUE constraint ile engellenir
- `RfqDetail.tsx`'de tedarikçi başına subtotal gösterimi

---

## Tedarikçi Award Sayfası İyileştirmeleri — 2026-05

### Değiştirildi

**Sipariş kalemleri tablosu** (`2a2cf30`)
- `/quote/:token` award sayfasında sadece toplam tutar yerine tam sipariş kalemi dökümü gösterilir
- `AwardedOrderItem` tipi: ürün adı, birim, onaylı marka, onaylı miktar, birim fiyat
- Kalem başına satır toplamı hesaplanır; genel toplam footer'da

**UI polish** (`cf5df58`)
- Beyaz logo/header şeridi kaldırıldı; alıcı kimliği (logo + firma adı) siyah header içine taşındı
- Başarı kartındaki tutar satırı kaldırıldı (tablo footer'ında zaten var)

**Logo render düzeltmesi** (`2ceb6ee`)
- `filter: "brightness(0) invert(1)"` kaldırıldı (logoyu beyaz siletle kapatıyordu)
- Logo, `rgba(255,255,255,0.92)` arka planlı, `padding: 3px` yuvarlak köşeli container içinde gösterilir

---

## RFQ Karşılaştırma Tablosu Polish — 2026-05

### Değiştirildi (`cfafd20`)
- Meta bilgi chip'leri: oluşturulma tarihi, deadline (gecikmiş ise kırmızı + `AlertTriangle`), kalem sayısı, tedarikçi sayısı
- Tedarikçi kolon başlığı: avatar + firma adı + `Seçildi`/`En ucuz`/`delivery_time`/`payment_terms` pill'leri
- Bekleyen tedarikçiler tablo dışında ayrı kart; cevap gelince kaybolur
- "En Ucuz Karma" tablo içinden çıkarıldı; tablo altında bağımsız kart olarak — item başına ucuz tedarikçi breakdown
- Action row: `2px solid #e6ddd4` güçlü bölüm ayracı

---

## Dashboard & Layout İyileştirmeleri — 2026-05

### Değiştirildi (`520651f`, `0ec59a1`, `3d427fe`, `f54d711`)
- Dashboard 3 kolonlu grid: RFQ listesi | Aktivite feed | Widget'lar (deadline yaklaşanlar, yanıt oranı, sipariş sayısı)
- Listelerde 10 öğe gösterimi
- RFQ ve yeni RFQ sayfaları PDF tasarımına uyarlandı
- Navigasyon hamburger drawer'a taşındı (masaüstü + mobil)

---

## Mail Şablon Sistemi İyileştirmeleri — 2026-05

### Değiştirildi (`f72c51b`)
- Admin mail şablon editörü warm earth-tone design system'e uyarlandı
- Hizalama kontrolü (sol/orta/sağ) bölüm bazında eklendi
- Değişken butonları, canlı önizleme panel

---

## Teknik Notlar

### Kritik Pattern'lar

**PostgREST ambiguous FK:** `rfqs` ve `rfq_recipients` arasında çift FK olduğundan explicit hint zorunlu:
```
rfqs!rfq_recipients_rfq_id_fkey(id, title, ...)
```

**Supabase join dizi tipi:** Join sonucu dizi gelebilir:
```ts
const item = Array.isArray(raw) ? raw[0] : raw;
```

**Currency güvenliği:** Client'tan gelen currency asla kullanılmaz:
```ts
const orderCurrency: Currency = SUPPORTED_CURRENCIES.includes(rfq.currency as Currency)
  ? (rfq.currency as Currency)
  : "USD";
```

**Set spread TypeScript sorunu:** `new Set([...prev, id])` yerine:
```ts
const next = new Set(prev); next.add(id); return next;
```

**Git commit (Turkish path):** `git commit -m "$(cat <<'EOF'...)"` Bash heredoc path'deki Türkçe karakterlerde parse hatası verir. PowerShell `@'...'@` heredoc kullanılır.
