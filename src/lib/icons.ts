import {
  BarChart3,
  Briefcase,
  Clapperboard,
  Code2,
  Megaphone,
  Sparkles,
  Timer,
  Workflow,
  type LucideIcon,
} from "lucide-react";

/** Maps the category icon keys stored in mock data to Lucide components. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  workflow: Workflow,
  "code-2": Code2,
  sparkles: Sparkles,
  clapperboard: Clapperboard,
  megaphone: Megaphone,
  "bar-chart-3": BarChart3,
  briefcase: Briefcase,
  timer: Timer,
};

export function categoryIcon(key: string): LucideIcon {
  return CATEGORY_ICONS[key] ?? Sparkles;
}
