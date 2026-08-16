import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal/legal-article";

export const metadata: Metadata = { title: "Privacy Policy — MYSEOULDROP" };

// NOTE: Draft copy. Must pass legal review before public launch.
const SECTIONS = [
  { heading: "What we collect", body: [
    "Account basics (name, email, and — only if you verify one — your phone number), your beauty profile (hair and skin type, concerns, interests), your saved places and ratings, and — only while the map is open and with your permission — your device location.",
  ]},
  { heading: "How we use it", body: [
    "To personalize recommendations and show nearby places on the map. We do not sell your personal data, and we do not share it with venues — MYSEOULDROP currently has no booking features.",
  ]},
  { heading: "Location", body: [
    "Map location is used on-device to sort places by distance. It is not stored on our servers. You can decline the permission and browse from a default area instead.",
  ]},
  { heading: "Retention & your rights", body: [
    "We keep your data while your account is active. You can download a copy of your data or permanently delete your account at any time from Settings → Data & privacy — deletion is immediate and removes your account, profile, saved places, and ratings.",
  ]},
  { heading: "Sensitive data", body: [
    "Skin and hair characteristics you share are used only for recommendations. We never infer or store medical conditions.",
  ]},
];

export default function PrivacyPage() {
  return (
    <LegalArticle
      title="Privacy Policy"
      updated="Jul 5, 2026"
      intro="This policy explains what MYSEOULDROP collects, why, and the choices you have — written for travelers, not lawyers."
      sections={SECTIONS}
    />
  );
}
