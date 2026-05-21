import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
};

export default function EmptyState({ icon: Icon, title, description, className, children }: Props) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-6 text-center", className)}>
      {Icon && (
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
          style={{ background: "#f5f0eb" }}
        >
          <Icon className="w-5 h-5" style={{ color: "#7a6e67" }} />
        </div>
      )}
      <p className="text-sm font-medium mb-1" style={{ color: "#111" }}>{title}</p>
      {description && (
        <p className="text-xs max-w-xs" style={{ color: "#7a6e67" }}>{description}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
