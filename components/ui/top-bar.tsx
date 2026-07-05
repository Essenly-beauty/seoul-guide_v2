import type { ReactNode } from "react";

type TopBarProps = {
  left?: ReactNode;
  title?: ReactNode;
  right?: ReactNode;
  center?: boolean;
  titleClassName?: string;
};

/** Sticky top bar. When `center` is set, an empty spacer balances the title. */
export function TopBar({ left, title, right, center, titleClassName }: TopBarProps) {
  return (
    <div className={"topbar" + (center ? " center" : "")}>
      {left}
      {title !== undefined && <span className={"title " + (titleClassName ?? "")}>{title}</span>}
      {right ?? (center ? <span style={{ width: 40 }} /> : null)}
    </div>
  );
}
