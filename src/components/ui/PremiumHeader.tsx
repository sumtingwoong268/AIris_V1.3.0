import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/airis-logo-uploaded.png";

type PremiumHeaderProps = {
    title: string;
    subtitle?: string;
    backRoute?: string;
    rightContent?: ReactNode;
    children?: ReactNode;
    onBack?: () => void;
};

export function PremiumHeader({ title, subtitle, backRoute = "/dashboard", rightContent, children, onBack }: PremiumHeaderProps) {
    const navigate = useNavigate();

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            navigate(backRoute);
        }
    };

    return (
        <div className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
            <header className="pointer-events-auto flex w-full max-w-5xl items-center justify-between rounded-full border border-white/40 bg-white/80 px-6 py-3 shadow-xl shadow-indigo-500/5 backdrop-blur-xl transition-all hover:bg-white/90 dark:bg-slate-900/80 dark:border-white/10 supports-[backdrop-filter]:bg-white/60">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleBack}
                        className="rounded-full hover:bg-slate-100 -ml-2 dark:hover:bg-slate-800 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                    </Button>
                    <div
                        className="flex cursor-pointer items-center gap-3 group"
                        onClick={handleBack}
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-slate-900 to-slate-800 shadow-md group-hover:scale-105 transition-transform duration-300 overflow-hidden">
                            {/* Using the new uploaded logo */}
                            <img src={logo} alt="AIris" className="h-full w-full object-cover scale-110" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg font-bold leading-none text-slate-900 dark:text-white">
                                {title}
                            </span>
                            {subtitle && (
                                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider -mt-0.5">
                                    {subtitle}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {children && (
                    <div className="hidden md:flex items-center gap-1 mx-2">
                        {children}
                    </div>
                )}

                <div className="flex items-center gap-2">
                    {rightContent}
                </div>
            </header>
        </div>
    );
}
