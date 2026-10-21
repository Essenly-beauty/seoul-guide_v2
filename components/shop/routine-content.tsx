"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { ProductThumbnail } from "@/components/product/product-thumbnail";
import { useLocale } from "@/lib/i18n/locale-provider";
import { routes } from "@/lib/routes";
import { PRODUCTS, STEP_MAP, STEP_LABEL, type StepCategory } from "@/lib/data";
import styles from "./routine-content.module.css";

export function RoutineContent() {
  const { t } = useLocale();
  const [stepCount, setStepCount] = useState<3 | 5 | 7>(3);
  const steps = STEP_MAP[stepCount];

  const recFor = (step: StepCategory) => PRODUCTS.find((p) => p.stepCategory === step);

  return (
    <div className={styles.routine}>
      <h1 className="sr-only">{t("Routine")}</h1>
      <p className={styles.intro}>{t("Explore products for each step.")}</p>

      <div className={styles.selector} role="group" aria-label={t("Routine length")}>
        {([3, 5, 7] as const).map((n) => (
          <button type="button" key={n} aria-pressed={stepCount === n} onClick={() => setStepCount(n)}>{t("{count} steps", { count: n })}</button>
        ))}
      </div>

      <ol className={styles.steps}>
          {steps.map((step, i) => {
            const rec = recFor(step);
            return (
              <li className={styles.step} key={step}>
                  <h2 className={styles.heading}>
                    <span className={styles.number} aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                    {t(STEP_LABEL[step])}
                  </h2>
                  {rec ? (
                    <Link className={styles.product} href={routes.shopItem(rec.id)}>
                      <ProductThumbnail product={rec} size={72} style={{ background: "#fff" }} />
                      <span className={styles.copy}>
                        <span className={styles.brand}>{rec.brand}</span>
                        <span className={styles.name}>{rec.name}</span>
                      </span>
                      <Icon name="chev" size="sm" className={styles.chevron} aria-hidden="true" />
                    </Link>
                  ) : (
                    <p className={styles.intro}>{t("No products yet for this step.")}</p>
                  )}
              </li>
            );
          })}
      </ol>
    </div>
  );
}
