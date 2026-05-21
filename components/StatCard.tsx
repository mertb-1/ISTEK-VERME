import { cn } from "@/lib/utils";

type Variant = "default" | "warning" | "success" | "danger";

const VARIANT_STYLES: Record<Variant, { border: string; valueColor: string }> = {
  default: { border: "#e6ddd4", valueColor: "#111" },
  warning: { border: "#f5d0a0", valueColor: "#a06a00" },
  success: { border: "#a8d8b4", valueColor: "#1a7a3a" },
  danger:  { border: "#f5c0b0", valueColor: "#8b3a2a" },
};

type Props = {
  label: string;
  value: number | string;
  sub?: string;
  variant?: Variant;
  className?: string;
};

export default function StatCard({ label, value, sub, variant = "default", className }: Props) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className={cn("rounded-xl p-5", className)}
      style={{ background: "#fff", border: `1px solid ${styles.border}` }}
    >
      <p
        className="text-xs tracking-widest mb-3"
        style={{ color: "#7a6e67", letterSpacing: "0.1em" }}
      >
        {label}
      </p>
      <p
        className="font-display text-4xl font-bold mb-1 tabular-nums"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", color: styles.valueColor }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-xs" style={{ color: "#b0a49e" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
