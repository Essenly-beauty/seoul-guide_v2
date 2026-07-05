"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Icon, type IconName } from "@/components/icon";

/** Independently toggleable pick card (multi-select lists). */
export function PickToggle({
  icon,
  title,
  subtitle,
  initial = false,
  style,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  initial?: boolean;
  style?: CSSProperties;
}) {
  const [on, setOn] = useState(initial);
  return (
    <button className="pickcard" aria-pressed={on} style={style} onClick={() => setOn((v) => !v)}>
      <span className="ic"><Icon name={icon} /></span>
      <div>
        <b>{title}</b>
        {subtitle && <div className="caption muted">{subtitle}</div>}
      </div>
      <span className="chk"><Icon name="check" size="xs" /></span>
    </button>
  );
}
