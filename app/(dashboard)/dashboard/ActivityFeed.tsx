import Link from "next/link";
import { FileText, Send, Inbox, Award, CheckCircle, XCircle, Activity } from "lucide-react";
import EmptyState from "@/components/EmptyState";

export type ActivityItem = {
  type: "rfq_created" | "rfq_sent" | "quote_received" | "order_created" | "order_completed" | "order_cancelled";
  message: string;
  timestamp: string;
  link?: string;
};

const CONFIG: Record<ActivityItem["type"], { icon: React.ElementType; color: string; bg: string }> = {
  rfq_created:     { icon: FileText,    color: "#7a6e67", bg: "#f5f0eb" },
  rfq_sent:        { icon: Send,        color: "#a06a00", bg: "#fef5e4" },
  quote_received:  { icon: Inbox,       color: "#1a7a3a", bg: "#edf8f1" },
  order_created:   { icon: Award,       color: "#1a7a3a", bg: "#edf8f1" },
  order_completed: { icon: CheckCircle, color: "#1a7a3a", bg: "#edf8f1" },
  order_cancelled: { icon: XCircle,     color: "#8b3a2a", bg: "#fdf0ee" },
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
    <div className="rounded-xl overflow-hidden h-full" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
      <div className="px-5 py-3" style={{ borderBottom: "1px solid #e6ddd4", background: "#faf4ee" }}>
        <h2 className="text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>SON AKTİVİTELER</h2>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Henüz aktivite yok"
          description="Teklif talepleri oluşturdukça aktiviteler burada görünür."
          className="py-12"
        />
      ) : (
        <ul>
          {items.map((item, idx) => {
            const cfg = CONFIG[item.type];
            const Icon = cfg.icon;
            const isLast = idx === items.length - 1;

            const inner = (
              <div className="flex items-start gap-3 px-5 py-3.5">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: cfg.bg }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-snug" style={{ color: "#111" }}>{item.message}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#b0a49e" }}>{timeAgo(item.timestamp)}</p>
                </div>
              </div>
            );

            return (
              <li
                key={idx}
                style={!isLast ? { borderBottom: "1px solid #f0e8e0" } : undefined}
              >
                {item.link ? (
                  <Link
                    href={item.link}
                    className="block transition-colors hover:bg-[#fef5e4]"
                  >
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
