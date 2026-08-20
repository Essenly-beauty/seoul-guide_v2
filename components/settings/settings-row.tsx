import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";

type SettingsRowProps = {
  icon: IconName;
  title: string;
  value?: string;
  href: string;
};

/** One tappable settings destination: icon, label, optional current value. */
export function SettingsRow({ icon, title, value, href }: SettingsRowProps) {
  return (
    <Link className="settings-row" href={href}>
      <span className="settings-row-icon">
        <Icon name={icon} size="xs" />
      </span>
      <span className="settings-row-title">{title}</span>
      {value && <span className="settings-row-value">{value}</span>}
      <Icon name="chev" size="xs" className="settings-row-chevron" />
    </Link>
  );
}
