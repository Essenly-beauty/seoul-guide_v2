"use client";

// Feedback channel bottom sheet (docs/user-data-strategy.md §5): category
// 4-choice + message; current pathname is auto-attached. BottomSheet owns
// portal, focus trap, and close behavior.

import { useState, type ReactNode } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
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

  const canSubmit = category !== null && message.trim().length > 0;

  const submit = async () => {
    if (!category || !canSubmit) return;
    const sent = await submitFeedback({ category, message: message.trim(), contactOk: false, page: window.location.pathname });
    toast(sent ? "Thanks — we read every note." : "Saved offline — we'll send it with your next note.");
    onClose();
  };

  return (
    <BottomSheet title="Send feedback" kicker="Feedback" onClose={onClose}>
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
      <Button disabled={!canSubmit} style={canSubmit ? undefined : { opacity: 0.5 }} onClick={submit}>
        Send feedback
      </Button>
    </BottomSheet>
  );
}

/** Renders the trigger (children) and mounts the sheet while open. */
export function FeedbackLauncher({ children, className, style, variant, size }: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: ButtonVariant;
  size?: "md" | "sm";
}) {
  const [open, setOpen] = useState(false);
  const trigger = variant ? (
    <Button variant={variant} size={size} className={className} style={style} onClick={() => setOpen(true)}>
      {children}
    </Button>
  ) : (
    <button type="button" className={className} style={style} onClick={() => setOpen(true)}>
      {children}
    </button>
  );

  return (
    <>
      {trigger}
      {/* useDialogFocus restores focus to the trigger when the sheet closes. */}
      {open && <FeedbackSheet onClose={() => setOpen(false)} />}
    </>
  );
}
