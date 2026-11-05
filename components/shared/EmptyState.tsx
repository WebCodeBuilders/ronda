import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="fs-fade-in flex flex-col items-center justify-center py-10 lg:py-16 px-4 text-center">
      <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl flex items-center justify-center mb-4 bg-accent-light">
        <Icon className="w-7 h-7 lg:w-8 lg:h-8 text-accent" />
      </div>
      <h3 className="text-lg font-semibold mb-1 text-text-primary">{title}</h3>
      {description && <p className="text-sm mb-4 max-w-sm text-text-secondary">{description}</p>}
      {action}
    </div>
  );
}
