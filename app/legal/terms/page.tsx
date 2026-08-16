import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal/legal-article";

export const metadata: Metadata = { title: "Terms of Service — MYSEOULDROP" };

// NOTE: Draft copy. Must pass legal review before public launch.
const SECTIONS = [
  { heading: "Who we are", body: [
    "MYSEOULDROP is a discovery guide for beauty experiences in Seoul — salons, spas, head spas, skin clinics, and K-beauty shopping. We show you independent venues; we do not operate them, and we do not currently take bookings or payments.",
  ]},
  { heading: "Place information", body: [
    "Venue details (prices, hours, services) come from public listings and curated research and may be out of date. Always confirm important details with the venue before visiting. Example menus are illustrative, not venue-confirmed quotes.",
  ]},
  { heading: "Not medical advice", body: [
    "Content about clinics and procedures is informational only and is not medical advice. Medical procedures in Korea require an in-person consultation with a licensed practitioner. Always consult the clinic directly about suitability and risks.",
  ]},
  { heading: "Your content", body: [
    "Ratings and review notes you save must reflect your genuine experience. Review notes stay private unless you choose to post them publicly; public reviews show your first name. We may hide or remove public reviews that are fraudulent, offensive, or unrelated — including automatically after user reports.",
  ]},
  { heading: "Liability", body: [
    "Services are provided \"as is\". To the extent permitted by law, MYSEOULDROP is not liable for the acts or omissions of venues, nor for indirect damages arising from use of the app.",
  ]},
  { heading: "Governing law", body: [
    "These terms are governed by the laws of the Republic of Korea. Disputes are subject to the courts of Seoul.",
  ]},
];

export default function TermsPage() {
  return (
    <LegalArticle
      title="Terms of Service"
      updated="Jul 5, 2026"
      intro="These terms apply when you use MYSEOULDROP to discover, book, or review beauty experiences in Seoul. By using the app you agree to them."
      sections={SECTIONS}
    />
  );
}
