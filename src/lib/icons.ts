import {
  BarChart3,
  Bot,
  Briefcase,
  Clapperboard,
  Code2,
  Database,
  Gauge,
  Megaphone,
  Palette,
  Rocket,
  Sparkles,
  Target,
  Terminal,
  Timer,
  WandSparkles,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Maps the category icon keys stored in mock data (and in the admin category
 * store) to Lucide components. Keys are the single source of truth: the admin
 * editor writes the same keys, so a category always renders its own icon.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  workflow: Workflow,
  bot: Bot,
  "code-2": Code2,
  terminal: Terminal,
  sparkles: Sparkles,
  "wand-sparkles": WandSparkles,
  palette: Palette,
  clapperboard: Clapperboard,
  megaphone: Megaphone,
  target: Target,
  "bar-chart-3": BarChart3,
  database: Database,
  briefcase: Briefcase,
  rocket: Rocket,
  timer: Timer,
  zap: Zap,
  gauge: Gauge,
};

/** Key used when a category has no icon of its own. */
export const DEFAULT_CATEGORY_ICON = "sparkles";

/** Icons offered by the admin category editor, in picker order. */
export const CATEGORY_ICON_OPTIONS: { key: string; label: string }[] = [
  { key: "workflow", label: "Workflow" },
  { key: "bot", label: "Bot" },
  { key: "code-2", label: "Code" },
  { key: "terminal", label: "Terminal" },
  { key: "sparkles", label: "Sparkles" },
  { key: "wand-sparkles", label: "Magic wand" },
  { key: "palette", label: "Palette" },
  { key: "clapperboard", label: "Clapperboard" },
  { key: "gauge", label: "Gauge" },
  { key: "megaphone", label: "Megaphone" },
  { key: "target", label: "Target" },
  { key: "bar-chart-3", label: "Chart" },
  { key: "database", label: "Database" },
  { key: "briefcase", label: "Briefcase" },
  { key: "rocket", label: "Rocket" },
  { key: "timer", label: "Timer" },
  { key: "zap", label: "Bolt" },
];

export function categoryIcon(key?: string): LucideIcon {
  return (key ? CATEGORY_ICONS[key] : undefined) ?? CATEGORY_ICONS[DEFAULT_CATEGORY_ICON];
}
