import { useEffect, useState } from "react";
import { Sparkles, Trophy, Star } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface XPBannerProps {
    xp: number;
    level: number;
    username?: string;
    className?: string;
}

export function XPBanner({ xp, level, username, className }: XPBannerProps) {
    const [progress, setProgress] = useState(0);
    const xpForNextLevel = level * 100;
    const currentLevelXP = xp % 100;

    // Animate progress on mount
    useEffect(() => {
        const timer = setTimeout(() => setProgress(currentLevelXP), 500);
        return () => clearTimeout(timer);
    }, [currentLevelXP]);

    return (
        <div className={cn("relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-8 shadow-2xl shadow-indigo-500/20 text-white", className)}>
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-fuchsia-500/20 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/4 pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
                <div className="space-y-4 max-w-lg">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-bold uppercase tracking-wider shadow-sm animate-fade-in">
                        <Trophy className="h-3 w-3 text-yellow-300" />
                        <span>Level {level} Explorer</span>
                    </div>

                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight tracking-tight">
                        Hello, {username || "Visionary"}! <br />
                        <span className="text-indigo-200 text-lg md:text-xl font-medium">Ready to level up your vision?</span>
                    </h1>
                </div>

                <div className="w-full md:w-80 bg-white/10 backdrop-blur-md rounded-3xl p-5 border border-white/10 shadow-lg">
                    <div className="flex justify-between items-center mb-2 text-sm font-bold text-indigo-100">
                        <span className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-yellow-300 fill-yellow-300" />
                            Next Level
                        </span>
                        <span>{xp} / {xpForNextLevel} XP</span>
                    </div>

                    <div className="relative h-3 w-full bg-black/20 rounded-full overflow-hidden">
                        <div
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-yellow-300 to-amber-400 rounded-full transition-all duration-1000 ease-out box-shadow-glow"
                            style={{ width: `${progress}%`, boxShadow: '0 0 10px rgba(253, 224, 71, 0.5)' }}
                        />
                    </div>

                    <p className="mt-3 text-xs text-indigo-200 leading-relaxed">
                        Complete <strong>{100 - currentLevelXP} more XP</strong> to reach Level {level + 1}. Maintains your <strong>{level > 1 ? 'Legacy' : 'Rookie'}</strong> status!
                    </p>
                </div>
            </div>
        </div>
    );
}
