import { Trophy } from "lucide-react";

interface XPBarProps {
  xp: number;
  levelSize?: number;
}

export function XPBar({ xp, levelSize = 100 }: XPBarProps) {
  const level = Math.floor(xp / levelSize) + 1;
  const currentLevelXP = xp % levelSize;
  const progress = (currentLevelXP / levelSize) * 100;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-level/20 p-1.5 ring-1 ring-level/50">
            <Trophy className="h-4 w-4 text-level fill-level/20" />
          </div>
          <span className="font-bold text-foreground tracking-wide">Level {level}</span>
        </div>
        <span className="font-mono font-medium text-muted-foreground">
          {currentLevelXP} <span className="text-xs text-muted-foreground/70">/ {levelSize} XP</span>
        </span>
      </div>

      {/* 3D Glossy Bar Container */}
      <div className="relative h-6 w-full overflow-hidden rounded-full bg-slate-200/50 dark:bg-slate-800/50 shadow-inner ring-1 ring-black/5 dark:ring-white/10 backdrop-blur-sm">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.3)_50%,transparent_75%)] bg-[length:10px_10px] opacity-20" />

        {/* Fill Bar */}
        <div
          className="relative h-full bg-gradient-to-r from-primary-light via-primary to-primary-dark shadow-[2px_0_10px_rgba(59,130,246,0.5)] transition-all duration-1000 ease-out"
          style={{ width: `${progress}%` }}
        >
          {/* Shine Animation */}
          <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent" />

          {/* Glossy Top Highlight */}
          <div className="absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/40 to-transparent" />

          {/* Bottom Shadow for 3D depth */}
          <div className="absolute inset-x-0 bottom-0 h-[20%] bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      </div>
    </div>
  );
}
