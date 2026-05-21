import { cn } from "@/lib/utils";

type StatusConfig = {
  label: string;
  bg: string;
  color: string;
};

const STATUS_MAP: Record<string, StatusConfig> = {
  // RFQ
  open:                 { label: "Açık",            bg: "#fdf0ee", color: "#8b3a2a" },
  closed:               { label: "Kapalı",           bg: "#f5f0eb", color: "#7a6e67" },
  // Orders
  pending_confirmation: { label: "Onay Bekliyor",   bg: "#fef5e4", color: "#a06a00" },
  confirmed:            { label: "Onaylandı",        bg: "#edf8f1", color: "#1a7a3a" },
  completed:            { label: "Tamamlandı",       bg: "#edf8f1", color: "#1a7a3a" },
  cancelled:            { label: "İptal Edildi",     bg: "#fdf0ee", color: "#8b3a2a" },
  // RFQ recipients
  sent:                 { label: "Gönderildi",       bg: "#fef5e4", color: "#a06a00" },
  responded:            { label: "Teklif Verildi",   bg: "#edf8f1", color: "#1a7a3a" },
  awarded:              { label: "Seçildi",          bg: "#edf8f1", color: "#1a7a3a" },
  // Buyers
  pending:              { label: "Beklemede",        bg: "#fef5e4", color: "#a06a00" },
  approved:             { label: "Onaylandı",        bg: "#edf8f1", color: "#1a7a3a" },
  rejected:             { label: "Reddedildi",       bg: "#fdf0ee", color: "#8b3a2a" },
};

type Props = {
  status: string;
  label?: string;
  className?: string;
  dot?: boolean;
};

export default function StatusBadge({ status, label, className, dot = true }: Props) {
  const cfg = STATUS_MAP[status] ?? { label: status, bg: "#f5f0eb", color: "#7a6e67" };
  const displayLabel = label ?? cfg.label;

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded", className)}
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: cfg.color }}
        />
      )}
      {displayLabel}
    </span>
  );
}
