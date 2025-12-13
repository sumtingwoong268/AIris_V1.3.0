import { useState } from "react";
import { Languages } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LANGUAGE_OPTIONS, type LanguageCode, useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  compact?: boolean;
  className?: string;
  size?: "sm" | "default";
}

export function LanguageSwitcher({ compact = false, className, size = "default" }: LanguageSwitcherProps) {
  const { language, setLanguage, t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const currentLanguageLabel = LANGUAGE_OPTIONS.find((option) => option.code === language)?.label ?? language;

  const handleLanguageChange = async (code: LanguageCode) => {
    if (code === language) return;
    const nextLabel = LANGUAGE_OPTIONS.find((option) => option.code === code)?.label ?? code;
    setLanguage(code);
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ preferred_language: code, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      if (error) throw error;
      toast({
        title: t("nav.language"),
        description: `${currentLanguageLabel} → ${nextLabel}`,
      });
    } catch (error: any) {
      console.error("Failed to update language", error);
      toast({
        title: "Language not saved",
        description: error.message ?? "We couldn't save your language preference.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={size}
          className={cn(
            "gap-2 rounded-full border border-transparent hover:border-border",
            compact ? "px-3" : "px-4",
            className,
          )}
          disabled={loading}
        >
          <Languages className="h-4 w-4" />
          {!compact && <span className="text-sm font-medium">{t("nav.language")}</span>}
          <span className="text-xs uppercase text-muted-foreground">{language}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("nav.language")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGE_OPTIONS.map((option) => (
          <DropdownMenuItem key={option.code} onSelect={() => handleLanguageChange(option.code)}>
            <div className="flex items-center justify-between w-full">
              <span>{option.label}</span>
              {language === option.code && <span className="text-xs text-primary">Active</span>}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
