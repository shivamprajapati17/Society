import {
  Baby,
  Bell,
  Calendar,
  Home,
  Landmark,
  Leaf,
  Phone,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { IconName } from "@/lib/society.config";

const ICONS: Record<IconName, LucideIcon> = {
  leaf: Leaf,
  "shield-check": ShieldCheck,
  landmark: Landmark,
  users: Users,
  baby: Baby,
  bell: Bell,
  calendar: Calendar,
  phone: Phone,
  home: Home,
};

/** Renders a config icon by name, consistently sized and stroked. */
export default function SiteIcon({
  name,
  size = 22,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Landmark;
  return (
    <Icon
      className={className}
      size={size}
      strokeWidth={1.5}
      aria-hidden="true"
      focusable="false"
    />
  );
}
