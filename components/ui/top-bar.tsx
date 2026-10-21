import { T } from "@/lib/i18n/locale-provider";
import type { ReactNode } from "react";

type TopBarProps = {
  left?: ReactNode;
  title?: ReactNode;
  right?: ReactNode;
  center?: boolean;
  titleClassName?: string;
};

/** Sticky page header with stable control slots and a shared mobile height. */
export function TopBar({ left, title, right, center, titleClassName }: TopBarProps) {
  return (
    <div className={"topbar" + (center ? " center" : "")}>
      <span className="topbar-slot left">{left}</span>
      <span className={"title " + (titleClassName ?? "")}>{typeof title === "string" ? <T text={title} /> : title}</span>
      <span className="topbar-slot right">{right}</span>
    </div>
  );
}
