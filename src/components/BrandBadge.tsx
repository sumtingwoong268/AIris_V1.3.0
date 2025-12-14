import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import logo from "@/assets/airis-logo-new.png";

type BrandBadgeProps = {
  className?: string;
};

export const BrandBadge = ({ className }: BrandBadgeProps) => {
  return (
    <Link
      to="/"
      className={cn(
        "fixed left-3 top-3 z-[125] inline-flex items-center gap-3 rounded-full border border-border/70 bg-white/90 px-3 py-2 text-sm font-semibold text-slate-800 shadow-lg backdrop-blur transition hover:scale-105 dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-100",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900",
        className,
      )}
      aria-label="AIris home"
    >
      <img src={logo} alt="AIris" className="h-7 w-7 rounded-full object-contain" />
      <span className="hidden sm:inline">AIris</span>
    </Link>
  );
};
