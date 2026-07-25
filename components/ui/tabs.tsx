"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Chip } from "@/components/ui/chip";

type Panel = { key: string; label: string; content: ReactNode };

export function Tabs({ panels, defaultKey }: { panels: Panel[]; defaultKey?: string }) {
  const [active, setActive] = useState(defaultKey ?? panels[0]?.key);
  return (
    <>
      <div className="chiprow">
        {panels.map((p) => {
          const on = p.key === active;
          return (
            <Chip key={p.key} selected={on} onClick={() => setActive(p.key)}>
              {p.label}
            </Chip>
          );
        })}
      </div>
      {panels.map((p) => (
        <div key={p.key} className="stack" hidden={p.key !== active}>
          {p.content}
        </div>
      ))}
    </>
  );
}
