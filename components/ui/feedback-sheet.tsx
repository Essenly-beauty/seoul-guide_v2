"use client";

// Feedback channel bottom sheet (docs/user-data-strategy.md §5): category
// 4-choice + message + optional "get a reply" toggle; current pathname is
// auto-attached. Overlay/sheet/portal structure mirrors map/filter-sheet.tsx.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { useToast } from "@/components/ui/toast";
import { submitFeedback, type FeedbackCategory } from "@/lib/feedback";

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "idea", label: "Idea" },
  { value: "place", label: "Wrong place info" },
  { value: "other", label: "Other" },
];

function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState("");
  const [contactOk, setContactOk] = useState(false);
  const [host, setHost] = useState<Element | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Shared focus trap: Escape, Tab cycling, and focus restoration on close.
  const dialogRef = useDialogFocus<HTMLDivElement>(Boolean(host), onClose, closeRef);

  // Anchor to .app-shell like FilterSheet so the sheet outranks page chrome.
  useEffect(() => {
    setHost(document.querySelector(".app-shell"));
  }, []);

  if (!host) return null;

  const canSubmit = category !== null && message.trim().length > 0;

  const submit = () => {
    if (!category || !canSubmit) return;
    submitFeedback({ category, message: message.trim(), contactOk, page: window.location.pathname });
    toast("Thanks — we read every note.");
    onClose();
  };

  return createPortal(
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="sheet" role="dialog" aria-modal="true" aria-label="Send feedback" tabIndex={-1}>
        <div className="shead">
          <div>
            <div className="label">Feedback</div>
            <b>Send feedback</b>
          </div>
          <button ref={closeRef} className="iconbtn" aria-label="Close" onClick={onClose}><Icon name="x" size="sm" /></button>
        </div>
        <div className="sbody stack">
          <div>
            <div className="label">What&apos;s it about?</div>
            <div className="chipwrap" style={{ marginTop: 6 }}>
              {CATEGORIES.map((c) => (
                <Chip
                  key={c.value}
                  selected={category === c.value}
                  onClick={() => setCategory(c.value)}
                >
                  {c.label}
                </Chip>
              ))}
            </div>
          </div>
          <textarea
            className="input"
            aria-label="Your message"
            placeholder="Tell us what happened or what you'd love to see…"
            rows={4}
            maxLength={1000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ resize: "none", minHeight: 96, lineHeight: 1.45 }}
          />
          <div className="row" style={{ gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b className="t-label-md" style={{ fontSize: 14, display: "block" }}>Get a reply</b>
              <div className="t-caption">We may follow up on your account email.</div>
            </div>
            {/* Switch pattern from mypage/notifications-form.tsx */}
            <button
              role="switch"
              aria-checked={contactOk}
              aria-label="Get a reply"
              onClick={() => setContactOk((v) => !v)}
              style={{
                width: 46, height: 28, borderRadius: 999, flex: "none",
                background: contactOk ? "var(--accent)" : "var(--border)",
                position: "relative", transition: "background .2s",
              }}
            >
              <span style={{
                position: "absolute", top: 3, left: contactOk ? 21 : 3, width: 22, height: 22,
                borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "var(--shadow-card)",
              }} />
            </button>
          </div>
          <Button disabled={!canSubmit} style={canSubmit ? undefined : { opacity: 0.5 }} onClick={submit}>
            Send feedback
          </Button>
        </div>
      </div>
    </div>,
    host,
  );
}

/** Renders the trigger (children) and mounts the sheet while open. */
export function FeedbackLauncher({ children, className, style }: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} style={style} onClick={() => setOpen(true)}>
        {children}
      </button>
      {/* useDialogFocus restores focus to the trigger when the sheet closes. */}
      {open && <FeedbackSheet onClose={() => setOpen(false)} />}
    </>
  );
}
