import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: boolean;
}

export function Card({ padding = true, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        // Densidad móvil: menos padding para que el contenido entre; en lg el de siempre.
        padding && "p-4 lg:p-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function CardHeader({ title, description, icon, action, className, ...props }: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3 mb-4", className)} {...props}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-accent-light text-accent [&>svg]:w-5 [&>svg]:h-5">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-text-primary">{title}</p>
          {description && <p className="text-sm text-text-secondary">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
