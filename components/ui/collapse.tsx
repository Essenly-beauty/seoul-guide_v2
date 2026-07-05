"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "@/components/icon";

export function Collapse({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="card tap row between" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{summary}</span>
        <Icon name="chev" size="sm" style={{ color: "var(--dim)", transform: open ? "rotate(90deg)" : undefined, transition: "transform .2s" }} />
      </button>
      {open && <div>{children}</div>}
    </>
  );
}
