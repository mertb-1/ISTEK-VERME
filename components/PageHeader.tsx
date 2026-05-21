import { cn } from "@/lib/utils";

type Props = {
  eyebrow?: string;
  title: string;
  accentWord?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

/**
 * Standard page heading used across dashboard pages.
 *
 * Usage:
 *   <PageHeader
 *     eyebrow="SATIN ALMA · TEKLİF TALEPLERİ"
 *     title="Teklif"
 *     accentWord="kütüğü."
 *     description="Filonuza giden tüm teklif talepleri."
 *     action={<Link href="/rfq/new">+ Yeni Teklif</Link>}
 *   />
 *
 * Renders: eyebrow in small uppercase → large serif title with italic rust accent → description → action
 */
export default function PageHeader({ eyebrow, title, accentWord, description, action, className }: Props) {
  return (
    <div className={cn("mb-8", className)}>
      {eyebrow && (
        <p
          className="text-xs tracking-widest mb-3"
          style={{ color: "#7a6e67", letterSpacing: "0.12em" }}
        >
          {eyebrow}
        </p>
      )}
      <div className="flex items-end justify-between gap-4">
        <h1
          className="font-display text-5xl leading-tight"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {title}{" "}
          {accentWord && (
            <em style={{ color: "#8b3a2a", fontStyle: "italic" }}>{accentWord}</em>
          )}
        </h1>
        {action && <div className="flex-shrink-0 mb-1">{action}</div>}
      </div>
      {description && (
        <p className="text-sm mt-2" style={{ color: "#7a6e67" }}>
          {description}
        </p>
      )}
    </div>
  );
}
