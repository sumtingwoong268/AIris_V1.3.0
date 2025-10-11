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
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-level" />
          <span className="font-semibold text-foreground">Level {level}</span>
        </div>
        <span className="text-muted-foreground">
          {currentLevelXP} / {levelSize} XP
        </span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-xp-bg">
        <div
          className="h-full bg-gradient-to-r from-primary-light to-primary transition-all duration-1000 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
