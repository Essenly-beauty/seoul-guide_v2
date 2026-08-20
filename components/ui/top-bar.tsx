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
      <span className={"title " + (titleClassName ?? "")}>{title}</span>
      <span className="topbar-slot right">{right}</span>
    </div>
  );
}
