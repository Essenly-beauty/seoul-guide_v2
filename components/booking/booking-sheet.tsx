"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { routes } from "@/lib/routes";

const SERVICES = [
  { name: "Signature Scalp Therapy", meta: "90 min · scalp + aroma", price: "₩180,000" },
  { name: "Premium Hair Therapy", meta: "120 min · treatment + blow dry", price: "₩260,000" },
  { name: "Express Scalp Refresh", meta: "45 min", price: "₩90,000" },
];

const TIMES: { label: string; disabled?: boolean }[] = [
  { label: "10:00", disabled: true }, { label: "11:00" }, { label: "12:00", disabled: true }, { label: "13:00" },
  { label: "14:00" }, { label: "15:00" }, { label: "16:00", disabled: true }, { label: "17:00" },
  { label: "18:00" }, { label: "19:00" }, { label: "20:00", disabled: true }, { label: "21:00" },
];

const STEP_LABEL = (i: number) =>
  i >= 4 ? "CONFIRMED · HOSU DOSAN" : `STEP ${i + 1} OF 4 · HOSU DOSAN · 호수 도산점`;

export function BookingSheet({
  triggerLabel = "Book Now →",
  triggerClassName = "btn",
  triggerStyle,
}: {
  triggerLabel?: string;
  triggerClassName?: string;
  triggerStyle?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [service, setService] = useState(0);
  const [alone, setAlone] = useState(true);
  const [time, setTime] = useState("14:00");
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>(open, () => setOpen(false), closeRef);
  const router = useRouter();

  function start() {
    setStep(0);
    setService(0);
    setAlone(true);
    setTime("14:00");
    setOpen(true);
  }
  function close(then?: string) {
    setOpen(false);
    if (then) router.push(then);
  }

  const pct = (Math.min(step + 1, 4) / 4) * 100;

  return (
    <>
      <button type="button" className={triggerClassName} style={triggerStyle} onClick={start}>
        {triggerLabel}
      </button>

      {open && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div
            ref={dialogRef}
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-sheet-title"
            tabIndex={-1}
          >
            <div className="handle" />
            <div className="shead">
              <span id="booking-sheet-title" className="steplabel" style={{ flex: 1 }}>{STEP_LABEL(step)}</span>
              <button ref={closeRef} type="button" className="iconbtn" aria-label="Close" onClick={() => setOpen(false)}>
                <Icon name="x" size="sm" />
              </button>
            </div>
            <div style={{ padding: "0 18px" }}>
              <div className="progress"><div className="fill" style={{ width: pct + "%" }} /></div>
            </div>

            <div className="sbody">
              {step === 0 && (
                <div style={{ paddingTop: 16 }}>
                  <h2 className="h2">Are you booking just for yourself?</h2>
                  <div className="stack" style={{ marginTop: 14 }}>
                    <button className="pickcard" aria-pressed={alone} onClick={() => setAlone(true)}>
                      <div><b>Yes — just me</b><div className="caption muted">One service, one slot.</div></div>
                      <span className="chk" style={{ marginLeft: "auto" }}><Icon name="check" size="xs" /></span>
                    </button>
                    <button className="pickcard" aria-pressed={!alone} onClick={() => setAlone(false)}>
                      <div><b>No — with friends or family</b><div className="caption muted">Each person picks their own service.</div></div>
                      <span className="chk" style={{ marginLeft: "auto" }}><Icon name="check" size="xs" /></span>
                    </button>
                  </div>
                  <div className="banner info" style={{ marginTop: 14 }}>
                    <Icon name="check" size="sm" />
                    <span>Deposit (25%) is charged now per service. Balance is paid at the salon.</span>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div style={{ paddingTop: 16 }}>
                  <h2 className="h2">Pick a service</h2>
                  <div className="stack" style={{ marginTop: 12 }}>
                    {SERVICES.map((s, i) => (
                      <button key={s.name} className="pickcard" aria-pressed={service === i} onClick={() => setService(i)}>
                        <div><b>{s.name}</b><div className="caption muted">{s.meta}</div></div>
                        <span className="price mono" style={{ marginLeft: "auto", fontWeight: 600 }}>{s.price}</span>
                      </button>
                    ))}
                  </div>
                  <div className="label" style={{ marginTop: 14 }}>Desired style (optional)</div>
                  <input className="input" placeholder="e.g., 'soft layered cut, ash brown'" style={{ marginTop: 6 }} />
                </div>
              )}

              {step === 2 && (
                <div style={{ paddingTop: 16 }}>
                  <h2 className="h2">Available times — Mon, May 4</h2>
                  <div className="timegrid" style={{ marginTop: 14 }}>
                    {TIMES.map((t) => (
                      <button
                        key={t.label}
                        className="timeslot"
                        disabled={t.disabled}
                        aria-pressed={!t.disabled && time === t.label}
                        onClick={() => !t.disabled && setTime(t.label)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <p className="caption muted" style={{ marginTop: 12 }}>The salon may stagger start times if needed.</p>
                </div>
              )}

              {step === 3 && (
                <div style={{ paddingTop: 16 }}>
                  <h2 className="h2">Confirm &amp; pay</h2>
                  <div className="card stack sm" style={{ marginTop: 12 }}>
                    <div className="kv"><span className="k">When</span><span className="v" style={{ fontFamily: "var(--sans)" }}>Mon, May 4 · {time}</span></div>
                    <div className="kv"><span className="k">{SERVICES[service].name}</span><span className="v">{SERVICES[service].price}</span></div>
                    <div className="divider-accent" />
                    <div className="kv"><span className="k">Total service price</span><span className="v">{SERVICES[service].price}</span></div>
                    <div className="kv"><span className="k" style={{ color: "var(--accent)", fontWeight: 600 }}>Deposit (25%) — pay now</span><span className="v" style={{ color: "var(--accent)" }}>₩45,000</span></div>
                    <div className="kv"><span className="k">Balance — at the salon</span><span className="v">₩135,000</span></div>
                  </div>
                  <div className="card row" style={{ gap: 10, marginTop: 10 }}>
                    <Icon name="lock" size="sm" style={{ color: "var(--muted)" }} />
                    <div><b className="small">Stripe Payment Element</b><div className="caption muted">Card · Apple Pay · Google Pay <span className="badge dim">Demo</span></div></div>
                  </div>
                  <p className="caption muted" style={{ marginTop: 10 }}>
                    <b>Plans change. We get it.</b> Up to 24h before, reschedule or cancel freely — full refund.
                  </p>
                </div>
              )}

              {step === 4 && (
                <div style={{ padding: "26px 0", textAlign: "center" }}>
                  <span className="ic" style={{ width: 64, height: 64, borderRadius: "var(--r-full)", background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
                    <Icon name="check" />
                  </span>
                  <h1 className="h1">Your booking is confirmed.</h1>
                  <p className="muted" style={{ marginTop: 8, maxWidth: "30ch", marginInline: "auto" }}>
                    We&apos;ve held your deposit. HOSU DOSAN confirms within 24h.
                  </p>
                  <div className="card stack sm" style={{ marginTop: 16, textAlign: "left" }}>
                    <div className="kv"><span className="k">Confirmation</span><span className="v">HS-4F92A1</span></div>
                    <div className="kv"><span className="k">Deposit charged</span><span className="v" style={{ color: "var(--accent)" }}>₩45,000</span></div>
                    <div className="kv"><span className="k">Balance at salon</span><span className="v">₩135,000</span></div>
                  </div>
                  <p className="caption dim" style={{ marginTop: 12 }}>— Essentially Yours, essenly.</p>
                </div>
              )}
            </div>

            <div className="sfoot">
              {step < 3 && (
                <div className="row" style={{ gap: 10 }}>
                  {step > 0 && (
                    <Button variant="secondary" style={{ flex: 1 }} onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</Button>
                  )}
                  <Button style={{ flex: 2 }} onClick={() => setStep((s) => s + 1)}>Continue →</Button>
                </div>
              )}
              {step === 3 && (
                <Button onClick={() => setStep(4)}>Confirm &amp; Pay ₩45,000</Button>
              )}
              {step === 4 && (
                <div className="row" style={{ gap: 10 }}>
                  <Button variant="secondary" style={{ flex: 1 }} onClick={() => close(routes.map)}>Done</Button>
                  <Button style={{ flex: 1 }} onClick={() => close(routes.bookings)}>My Bookings</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
