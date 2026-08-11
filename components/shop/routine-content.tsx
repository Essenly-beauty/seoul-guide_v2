"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { ActionButton } from "@/components/ui/action-button";
import { routes } from "@/lib/routes";
import { PRODUCTS, STEP_MAP, STEP_LABEL, type StepCategory } from "@/lib/data";

export function RoutineContent() {
  const [stepCount, setStepCount] = useState<3 | 5 | 7>(3);
  const steps = STEP_MAP[stepCount];

  const recFor = (step: StepCategory) => PRODUCTS.find((p) => p.stepCategory === step);

  return (
    <div className="stack">
      <div>
        <div className="label">Your Routine</div>
        <h1 className="h1">K-Beauty Routine</h1>
        <p className="muted" style={{ marginTop: 6 }}>Curated for Dry skin · hydration + brightening.</p>
      </div>

      <div className="segmented" role="tablist">
        {([3, 5, 7] as const).map((n) => (
          <button key={n} aria-pressed={stepCount === n} onClick={() => setStepCount(n)}>{n}-Step</button>
        ))}
      </div>

      <div className="card">
        <div className="routine-timeline">
          {steps.map((step, i) => {
            const rec = recFor(step);
            return (
              <div className={"rt-step" + (rec ? " done" : "")} key={step}>
                <div className="rt-rail">
                  <span className="rt-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="rt-line" />
                </div>
                <div className="rt-body">
                  <div className="rt-label">{STEP_LABEL[step]}</div>
                  {rec ? (
                    <Link className="rt-product" href={routes.shopItem(rec.id)}>
                      <div className="thumb hero-img" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ display: "block" }}>{rec.name}</b>
                        <div className="name-kr">{rec.nameKr}</div>
                        <div className="caption muted" style={{ marginTop: 3 }}>{rec.brand} · {rec.priceRange}</div>
                      </div>
                      <Icon name="chev" size="sm" className="chev" />
                    </Link>
                  ) : (
                    <p className="rt-empty">No products yet for this step.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2026-07-25: `outline` → `secondary` (identical styles; ghost/outline classes are deprecated aliases) */}
      <ActionButton variant="secondary" toast="Routine added to favorites"><Icon name="heart-o" size="sm" /> Add to Favorites</ActionButton>

    </div>
  );
}
