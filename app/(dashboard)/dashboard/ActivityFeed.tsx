import Link from "next/link";
import { FileText, Send, Inbox, Award, CheckCircle, XCircle } from "lucide-react";

export type ActivityItem = {
  type: "rfq_created" | "rfq_sent" | "quote_received" | "order_created" | "order_completed" | "order_cancelled";
  message: string;
  timestamp: string;
  link?: string;
};

const CONFIG: Record<ActivityItem["type"], { icon: React.ElementType; color: string; bg: string }> = {
  rfq_created:      { icon: FileText,    color: "#7a6e67", bg: "#f5f0eb" },
  rfq_sent:         { icon: Send,        color: "#a06a00", bg: "#fef5e4" },
  quote_received:   { icon: Inbox,       color: "#1a7a3a", bg: "#edf8f1" },
  order_created:    { icon: Award,       color: "#1a7a3a", bg: "#edf8f1" },
  order_completed:  { icon: CheckCircle, color: "#1a7a3a", bg: "#edf8f1" },
  order_cancelled:  { icon: XCircle,     color: "#8b3a2a", bg: "#fdf0ee" },
};

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "az önce";
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d} gün önce`;
  return new Date(ts).toLocaleDateString("tr-TR");
}

export default function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
      <div className="px-6 py-4" style={{ borderBottom: "1px solid #e6ddd4" }}>
        <h2 className="text-sm font-semibold" style={{ color: "#111" }}>SON AKTİVİTELER</h2>
      </div>

      {items.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm" style={{ color: "#7a6e67" }}>Henüz aktivite yok.</p>
        </div>
      ) : (
        <ul className="divide-y" style={{ borderColor: "#f0e8e0" }}>
          {items.map((item, idx) => {
            const cfg = CONFIG[item.type];
            const Icon = cfg.icon;
            const inner = (
              <div className="flex items-start gap-4 px-6 py-4">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: cfg.bg }}
                >
                  <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug" style={{ color: "#111" }}>{item.message}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#b0a49e" }}>{timeAgo(item.timestamp)}</p>
                </div>
              </div>
            );

            return (
              <li key={idx}>
                {item.link ? (
                  <Link href={item.link} className="block transition-colors hover:bg-amber-50">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
