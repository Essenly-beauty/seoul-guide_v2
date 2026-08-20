"use client";

import { Chip } from "@/components/ui/chip";
import { useToast } from "@/components/ui/toast";
import {
  QUESTIONS,
  answerQuestion,
  profileCompleteness,
  useProfile,
} from "@/lib/profile";

export function BeautyProfileEditor() {
  const profile = useProfile();
  const { toast } = useToast();
  const completeness = profileCompleteness(profile);

  return (
    <section className="profile-editor" aria-label="Beauty profile answers">
      <div className="profile-editor-progress">
        <div className="row between">
          <b>Profile completeness</b>
          <span className="t-label-sm" style={{ color: "var(--accent)" }}>{completeness}%</span>
        </div>
        <div className="rbar" role="progressbar" aria-valuenow={completeness} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${completeness}%` }} />
        </div>
        <p className="t-caption">Every answer stays editable as your plans change.</p>
      </div>

      <div className="profile-editor-questions">
        {QUESTIONS.map((question, index) => (
          <section className="profile-question" key={question.key} aria-labelledby={`profile-question-${question.key}`}>
            <div className="profile-question-copy">
              <span className="label">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h2 id={`profile-question-${question.key}`}>{question.title}</h2>
                <p className="t-caption">{question.why}</p>
              </div>
            </div>
            <div className="chipwrap" role={question.multi ? "group" : "radiogroup"} aria-label={question.title}>
              {question.options.map((option) => {
                const selected = question.key === "interests"
                  ? profile.interests.includes(option.value as (typeof profile.interests)[number])
                  : profile[question.key] === option.value;
                return (
                  <Chip
                    key={option.value}
                    selected={selected}
                    role={question.multi ? undefined : "radio"}
                    aria-checked={question.multi ? undefined : selected}
                    onClick={() => {
                      answerQuestion(question.key, option.value);
                      toast("Profile updated");
                    }}
                  >
                    {option.label}
                  </Chip>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
