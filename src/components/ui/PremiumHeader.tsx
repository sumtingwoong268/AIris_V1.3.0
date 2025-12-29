import React, { ReactNode, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import logo from "@/assets/airis-logo-uploaded.png";

type PremiumHeaderProps = {
    title: string;
    subtitle?: string;
    backRoute?: string;
    rightContent?: ReactNode;
    children?: ReactNode;
    onBack?: () => void;
    hideBackArrow?: boolean;
};

export function PremiumHeader({ title, subtitle, backRoute = "/dashboard", rightContent, children, onBack, hideBackArrow }: PremiumHeaderProps) {
    const navigate = useNavigate();

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            navigate(backRoute);
        }
    };

    useEffect(() => {
        if (isMenuOpen) {
            document.body.setAttribute('data-menu-open', 'true');
        } else {
            document.body.removeAttribute('data-menu-open');
        }
        return () => document.body.removeAttribute('data-menu-open');
    }, [isMenuOpen]);

    return (
        <div className="fixed left-0 right-0 z-50 flex justify-center px-4 sm:px-6 top-4 pointer-events-none">
            <header
                className="relative z-50 pointer-events-auto flex w-full max-w-5xl items-center justify-between px-5 sm:px-8 py-4 transition-all rounded-full bg-white/80 dark:bg-[#050915]/80 backdrop-blur-xl border border-slate-200 dark:border-white/5 shadow-lg shadow-slate-200/50 dark:shadow-black/50"
                style={{
                    paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
                }}
            >
                {/* Left Section: Back Button (Absolute) */}
                <div className="absolute left-6 top-1/2 -translate-y-1/2 z-20">
                    {!hideBackArrow && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleBack}
                            className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                        </Button>
                    )}
                </div>

                {/* Center Section: Logo + Title + Desktop Nav Links */}
                <div className="flex flex-1 items-center justify-center gap-6">
                    {/* Brand Group */}
                    <div
                        className="flex cursor-pointer items-center gap-3 group"
                        onClick={handleBack}
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-slate-900 to-slate-800 shadow-md group-hover:scale-105 transition-transform duration-300 overflow-hidden">
                            <img src={logo} alt="AIris" className="h-full w-full object-cover scale-110" />
                        </div>
                        <div className="flex flex-col h-10 justify-center">
                            <span className="text-lg font-bold text-slate-900 dark:text-white">
                                {title}
                            </span>
                            {subtitle && (
                                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider -mt-0.5">
                                    {subtitle}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Navigation Links (Desktop) */}
                    {children && (
                        <div className="hidden lg:flex items-center gap-1">
                            {children}
                        </div>
                    )}
                </div>

                {/* Right Section: Mobile Menu & Extra Content (Absolute) */}
                <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 flex items-center gap-2">
                    {rightContent}
                    <div className="flex items-center lg:hidden">
                        <Sheet onOpenChange={setIsMenuOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-full" aria-label="Open menu">
                                    <Menu className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent
                                side="right"
                                className="w-[92vw] max-w-[320px] sm:max-w-[360px] dark:bg-slate-950/95 backdrop-blur-xl border-l-white/10"
                            >
                                <SheetHeader>
                                    <SheetTitle className="sr-only">AIris navigation</SheetTitle>
                                </SheetHeader>
                                <div className="flex flex-col gap-4 mt-6">
                                    <div className="flex items-center gap-3 mb-4 px-2">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-slate-900 to-slate-800 shadow-md overflow-hidden">
                                            <img src={logo} alt="AIris" className="h-full w-full object-cover scale-110" />
                                        </div>
                                        <span className="text-xl font-bold text-slate-900 dark:text-white">AIris</span>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {React.Children.count(children) > 0 ? (
                                            React.Children.toArray(children).map((child, index) => (
                                                <SheetClose asChild key={index}>
                                                    {child}
                                                </SheetClose>
                                            ))
                                        ) : (
                                            <div className="text-sm text-slate-500 dark:text-slate-400 px-2 py-1 rounded-lg bg-slate-100/60 dark:bg-slate-800/60">
                                                No navigation items provided.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </header>
        </div>
    );
}
