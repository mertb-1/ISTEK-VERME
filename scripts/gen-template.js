const XLSX = require("xlsx");
const path = require("path");

const wb = XLSX.utils.book_new();
const data = [
  ["Ürün Adı", "Marka", "Miktar", "Birim", "IMPA Kodu", "Açıklama"],
  ["Deniz Feneri Lambası", "Güral", "5", "adet", "550101", "IP65 su geçirmez"],
  ["Motor Yağı 15W-40", "Shell", "20", "lt", "471013", "Mineral bazlı"],
  ["Emniyet Yeleği", "", "10", "adet", "", "SOLAS onaylı"],
];
const ws = XLSX.utils.aoa_to_sheet(data);

// Sütun genişlikleri
ws["!cols"] = [
  { wch: 30 }, { wch: 15 }, { wch: 10 },
  { wch: 10 }, { wch: 12 }, { wch: 30 },
];

XLSX.utils.book_append_sheet(wb, ws, "Ürün Listesi");
const outPath = path.join(__dirname, "..", "public", "rfq-template.xlsx");
XLSX.writeFile(wb, outPath);
console.log("Template oluşturuldu:", outPath);
