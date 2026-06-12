import { normalizeForMatch } from "./keywords";
import type { QuoteParsedRow } from "./quote-import";

// Cevaplanmış tedarikçi dosyalarını birleşik ürün listesine dönüştürür.
// Her grup ileride bir rfq_item olur; üyeler tedarikçi başına quote_item olur.

export interface SupplierParsedFile {
  supplier_id: string;
  rows: QuoteParsedRow[];
}

export interface ProductGroupMember {
  supplier_id: string;
  row: QuoteParsedRow;
}

export interface ProductGroup {
  /** Client tarafında üretilen geçici kimlik — API'de rfq_item eşlemesi için */
  temp_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  impa_code: string | null;
  members: ProductGroupMember[];
  /** Aynı gruba düşen farklı ürün adları (IMPA gruplamasında olabilir) */
  name_variants: string[];
  /** Dosyalar arası miktar çelişkisi var mı (UI'da amber uyarı için) */
  quantity_conflict: boolean;
}

// Mevcut UI 6 haneli IMPA varsayar (rfq/new validasyonu) — geçersiz kodlar anahtar olmaz
export function isValidImpa(code: string | null | undefined): code is string {
  return typeof code === "string" && /^\d{6}$/.test(code.trim());
}

/**
 * MVP gruplama kuralları (fuzzy eşleştirme YOK):
 * 1. Geçerli IMPA kodu eşleşirse aynı grup
 * 2. Yoksa normalize edilmiş ürün adı tam eşleşirse aynı grup
 * 3. Hiçbiri yoksa satır kendi grubunu açar (hata durumu değil —
 *    tek tedarikçili grup karşılaştırma tablosunda diğer sütunlarda "—" gösterir)
 *
 * Aynı tedarikçinin iki satırı otomatik olarak aynı gruba GİRMEZ
 * (bir tedarikçinin bir kaleme tek fiyatı olabilir) — ikinci satır yeni grup açar.
 * Sıralama ilk dosyanın satır sırasını korur; sonraki dosyaların
 * eşleşmeyen satırları sona eklenir.
 */
export function unifyProducts(files: SupplierParsedFile[]): ProductGroup[] {
  const groups: ProductGroup[] = [];
  const byImpa = new Map<string, ProductGroup>();
  const byName = new Map<string, ProductGroup>();
  // Miktar/birim dosyadan mı geldi, fallback mı — sonraki üyeler fallback'i ezebilsin
  const quantityFromFile = new Set<ProductGroup>();
  const unitFromFile = new Set<ProductGroup>();
  let seq = 0;

  for (const file of files) {
    for (const row of file.rows) {
      const impa = isValidImpa(row.impa_code) ? row.impa_code.trim() : null;
      const nameKey = normalizeForMatch(row.product_name);
      const rowUnit = row.unit.trim();

      let group: ProductGroup | undefined;
      if (impa && byImpa.has(impa)) {
        group = byImpa.get(impa);
      } else if (nameKey && byName.has(nameKey)) {
        group = byName.get(nameKey);
      }

      // Aynı tedarikçi grupta zaten varsa birleştirme — yeni grup aç
      if (group && group.members.some((m) => m.supplier_id === file.supplier_id)) {
        group = undefined;
      }

      if (group) {
        group.members.push({ supplier_id: file.supplier_id, row });

        if (row.quantity != null) {
          if (!quantityFromFile.has(group)) {
            group.quantity = row.quantity;
            quantityFromFile.add(group);
          } else if (row.quantity !== group.quantity) {
            group.quantity_conflict = true;
          }
        }

        if (rowUnit && !unitFromFile.has(group)) {
          group.unit = rowUnit;
          unitFromFile.add(group);
        }

        if (!group.product_name && row.product_name) {
          group.product_name = row.product_name;
        }
        if (
          row.product_name &&
          !group.name_variants.some((v) => normalizeForMatch(v) === nameKey)
        ) {
          group.name_variants.push(row.product_name);
        }

        // Ad ile kurulmuş gruba IMPA gelirse anahtar olarak kaydet
        if (impa && !group.impa_code) {
          group.impa_code = impa;
          if (!byImpa.has(impa)) byImpa.set(impa, group);
        }
      } else {
        seq += 1;
        const fresh: ProductGroup = {
          temp_id: `g${seq}`,
          product_name: row.product_name || (impa ? `IMPA ${impa}` : ""),
          quantity: row.quantity ?? 1,
          unit: rowUnit || "adet",
          impa_code: impa,
          members: [{ supplier_id: file.supplier_id, row }],
          name_variants: row.product_name ? [row.product_name] : [],
          quantity_conflict: false,
        };
        if (row.quantity != null) quantityFromFile.add(fresh);
        if (rowUnit) unitFromFile.add(fresh);
        if (impa && !byImpa.has(impa)) byImpa.set(impa, fresh);
        if (nameKey && !byName.has(nameKey)) byName.set(nameKey, fresh);
        groups.push(fresh);
      }
    }
  }

  return groups;
}
