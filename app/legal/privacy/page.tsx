import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal/legal-article";

export const metadata: Metadata = { title: "Privacy Policy — MYSEOULDROP" };

// NOTE: Draft copy. Must pass legal review before public launch.
const SECTIONS = [
  { heading: "What we collect", body: [
    "Account basics (name, email), your beauty profile (hair and skin type, concerns, interests), booking details (venue, date, services), and — only while the map is open and with your permission — your device location.",
  ]},
  { heading: "How we use it", body: [
    "To personalize recommendations, complete bookings with venues, show nearby places on the map, and send booking updates you opt into. We do not sell your personal data.",
  ]},
  { heading: "Sharing with venues", body: [
    "When you book, we share your name, requested services, and appointment details with that venue so they can serve you. Venues may not use this data for anything else.",
  ]},
  { heading: "Location", body: [
    "Map location is used on-device to sort places by distance. It is not stored on our servers. You can decline the permission and browse from a default area instead.",
  ]},
  { heading: "Retention & your rights", body: [
    "We keep your data while your account is active. You may request access, correction, or deletion at any time via Support. Deleting your account removes your profile and reviews within 30 days.",
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
