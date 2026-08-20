"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { useToast } from "@/components/ui/toast";
import { submitFeedback } from "@/lib/feedback";
import type { Place } from "@/lib/data";

const CORRECTION_TYPES = [
  { value: "name", label: "Wrong name", prompt: "What should the place be called?" },
  { value: "location", label: "Wrong location", prompt: "Where is the correct location?" },
  { value: "hours", label: "Wrong hours", prompt: "What are the correct opening hours?" },
  { value: "closed_day", label: "Closed day or holiday", prompt: "Which day was it closed?" },
  { value: "other", label: "Other", prompt: "What should we correct?" },
] as const;

type CorrectionType = (typeof CORRECTION_TYPES)[number]["value"];

export function PlaceCorrectionLauncher({ place }: { place: Place }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [issueType, setIssueType] = useState<CorrectionType | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const issue = CORRECTION_TYPES.find((item) => item.value === issueType);

  const close = () => {
    setOpen(false);
    setIssueType(null);
    setNote("");
  };

  const submit = async () => {
    if (!issueType || !issue || busy) return;
    setBusy(true);
    const cleanNote = note.trim();
    const result = await submitFeedback({
      category: "place",
      message: `[Place correction · ${issue.label}] ${place.name} (${place.id})${cleanNote ? `\n${cleanNote}` : ""}`,
      contactOk: false,
      page: `${window.location.pathname}#d-info`,
      metadata: {
        kind: "place_correction",
        placeId: place.id,
        placeName: place.name,
        issueType,
        note: cleanNote,
      },
    });
    setBusy(false);
    if (result === "lost") {
      toast("Couldn't send or save this correction — please try again.");
      return;
    }
    toast(result === "sent" ? "Thanks — we'll verify this place." : "Saved offline — we'll send it when you're back online.");
    close();
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        className="place-correction-trigger"
        onClick={() => setOpen(true)}
      >
        Report incorrect info
      </Button>
      {open && (
        <BottomSheet title="Fix place information" kicker="Help us improve" onClose={() => { if (!busy) close(); }}>
          <p className="place-correction-place">
            <b>{place.name}</b>
            <span className="t-caption">Choose what needs checking. A note is optional.</span>
          </p>
          <div>
            <div className="label">What is incorrect?</div>
            <div className="chipwrap place-correction-options">
              {CORRECTION_TYPES.map((item) => (
                <Chip
                  key={item.value}
                  selected={issueType === item.value}
                  onClick={() => setIssueType(item.value)}
                >
                  {item.label}
                </Chip>
              ))}
            </div>
          </div>
          <label className="place-correction-note">
            <span className="label">Details <span className="muted">(optional)</span></span>
            <textarea
              className="input"
              rows={3}
              maxLength={600}
              value={note}
              placeholder={issue?.prompt ?? "Add a helpful detail"}
              onChange={(event) => setNote(event.target.value)}
            />
            <span className="t-caption num">{note.length}/600</span>
          </label>
          <Button disabled={!issueType || busy} onClick={() => void submit()}>
            {busy ? "Sending…" : "Send correction"}
          </Button>
        </BottomSheet>
      )}
    </>
  );
}
