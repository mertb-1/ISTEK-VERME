"use client";

import { useEffect, useState } from "react";

type Buyer = {
  id: string;
  email: string;
  full_name: string;
  company_name: string;
  phone: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

const statusLabel: Record<string, { label: string; class: string }> = {
  pending: { label: "Bekliyor", class: "bg-yellow-100 text-yellow-700" },
  approved: { label: "Onaylı", class: "bg-green-100 text-green-700" },
  rejected: { label: "Reddedildi", class: "bg-red-100 text-red-700" },
};

export default function AdminBuyersPage() {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchBuyers = async () => {
    const res = await fetch("/api/admin/buyers");
    if (res.ok) setBuyers(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchBuyers(); }, []);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    await fetch("/api/admin/buyers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await fetchBuyers();
    setUpdating(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Admin — Alıcı Yönetimi</h1>
          <p className="text-gray-500 mt-1">Kayıt olan alıcıları onaylayın veya reddedin.</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {buyers.length === 0 ? (
            <div className="p-12 text-center text-gray-400">Kayıtlı alıcı bulunamadı.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Ad / Firma</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">E-posta</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Telefon</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Kayıt</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Durum</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {buyers.map((buyer) => (
                  <tr key={buyer.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{buyer.full_name}</div>
                      <div className="text-gray-400 text-xs">{buyer.company_name}</div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{buyer.email}</td>
                    <td className="px-5 py-3 text-gray-600">{buyer.phone || "—"}</td>
                    <td className="px-5 py-3 text-gray-400">
                      {new Date(buyer.created_at).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusLabel[buyer.status].class}`}>
                        {statusLabel[buyer.status].label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        {buyer.status !== "approved" && (
                          <button
                            onClick={() => updateStatus(buyer.id, "approved")}
                            disabled={updating === buyer.id}
                            className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg"
                          >
                            Onayla
                          </button>
                        )}
                        {buyer.status !== "rejected" && (
                          <button
                            onClick={() => updateStatus(buyer.id, "rejected")}
                            disabled={updating === buyer.id}
                            className="text-xs bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg"
                          >
                            Reddet
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
