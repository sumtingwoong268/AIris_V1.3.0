import React from "react";
import { cn } from "@/lib/utils";

type IconProps = React.HTMLAttributes<HTMLSpanElement> & {
  size?: number | string;
  color?: string;
  strokeWidth?: number;
  absoluteStrokeWidth?: boolean;
  fill?: boolean | number;
  weight?: number;
  grade?: number;
  opticalSize?: number;
};

const toNumber = (value: number | string | undefined): number | undefined => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const createIcon = (glyph: string) => {
  const Icon = React.forwardRef<HTMLSpanElement, IconProps>(
    (
      {
        className,
        size = 20,
        color,
        fill = 0,
        weight = 500,
        grade = 0,
        opticalSize,
        style,
        ...rest
      },
      ref,
    ) => {
      const fontSize = typeof size === "number" ? `${size}px` : size;
      const fillValue = typeof fill === "boolean" ? (fill ? 1 : 0) : fill;
      const opsz = opticalSize ?? Math.min(Math.max(toNumber(size) ?? 24, 20), 48);

      return (
        <span
          ref={ref}
          className={cn("material-symbols-rounded", className)}
          aria-hidden="true"
          style={{
            fontSize,
            color,
            lineHeight: 1,
            fontVariationSettings: `'FILL' ${fillValue}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${opsz}`,
            ...style,
          }}
          {...rest}
        >
          {glyph}
        </span>
      );
    },
  );
  Icon.displayName = `MaterialIcon(${glyph})`;
  return Icon;
};

export const ArrowLeft = createIcon("arrow_back");
export const ArrowRight = createIcon("arrow_forward");
export const ArrowUp = createIcon("arrow_upward");
export const ArrowDown = createIcon("arrow_downward");
export const BookOpenText = createIcon("menu_book");
export const Clock = createIcon("schedule");
export const Plus = createIcon("add");
export const Copy = createIcon("content_copy");
export const Flame = createIcon("local_fire_department");
export const Trophy = createIcon("emoji_events");
export const UserPlus = createIcon("person_add");
export const Check = createIcon("check");
export const X = createIcon("close");
export const Users = createIcon("groups");
export const BarChart3 = createIcon("bar_chart");
export const Calendar = createIcon("calendar_month");
export const Download = createIcon("download");
export const Edit3 = createIcon("edit");
export const Eye = createIcon("visibility");
export const Filter = createIcon("filter_list");
export const Search = createIcon("search");
export const Trash2 = createIcon("delete");
export const Upload = createIcon("upload");
export const Loader2 = createIcon("progress_activity");
export const CheckCircle2 = createIcon("check_circle");
export const RotateCcw = createIcon("rotate_left");
export const Shuffle = createIcon("shuffle");
export const Palette = createIcon("palette");
export const CalendarDays = createIcon("event");
export const Share2 = createIcon("share");
export const FileText = createIcon("description");
export const BookOpen = createIcon("menu_book");
export const Languages = createIcon("language");
export const Globe2 = createIcon("public");
export const Sparkles = createIcon("auto_awesome");
export const Star = createIcon("star");
export const Moon = createIcon("dark_mode");
export const Sun = createIcon("light_mode");
export const GripVertical = createIcon("drag_indicator");
export const ChevronRight = createIcon("chevron_right");
export const ChevronLeft = createIcon("chevron_left");
export const MoreHorizontal = createIcon("more_horiz");
export const ChevronDown = createIcon("expand_more");
export const ChevronUp = createIcon("expand_less");
export const Dot = createIcon("fiber_manual_record");
export const PanelLeft = createIcon("menu_open");
export const Circle = createIcon("radio_button_unchecked");
export const Menu = createIcon("menu");
export const ArrowRightCircle = createIcon("arrow_forward");
export const Grid3x3 = createIcon("grid_view");
export const Type = createIcon("text_fields");
export const User = createIcon("person");
export const Award = createIcon("emoji_events");
export const PlayCircle = createIcon("play_circle");
export const LineChart = createIcon("show_chart");
export const Zap = createIcon("bolt");
export const Shield = createIcon("shield");
export const TrendingUp = createIcon("trending_up");
export const TrendingDown = createIcon("trending_down");
export const Target = createIcon("track_changes");
export const Activity = createIcon("monitor_heart");
export const Timer = createIcon("timer");

// Additional icons used in smaller components
export const Globe = createIcon("public");
