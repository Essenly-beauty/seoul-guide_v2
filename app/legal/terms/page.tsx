import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal/legal-article";

export const metadata: Metadata = { title: "Terms of Service — MYSEOULDROP" };

// NOTE: Draft copy. Must pass legal review before public launch.
const SECTIONS = [
  { heading: "Who we are", body: [
    "MYSEOULDROP is a curation and booking companion for beauty experiences in Seoul — salons, spas, head spas, skin clinics, and K-beauty shopping. We connect you with independent venues; we do not operate them.",
  ]},
  { heading: "Bookings & deposits", body: [
    "Some venues require a deposit to confirm a reservation. Deposits are clearly shown before you confirm and are refundable per the cancellation window displayed at booking time (typically free cancellation up to 24 hours before your appointment).",
    "Venues set their own final prices. In-store totals may differ from estimates when you change services on site.",
  ]},
  { heading: "Not medical advice", body: [
    "Content about clinics and procedures is informational only and is not medical advice. Medical procedures in Korea require an in-person consultation with a licensed practitioner. Always consult the clinic directly about suitability and risks.",
  ]},
  { heading: "Your content", body: [
    "Reviews and photos you post must reflect your genuine experience. By posting, you grant MYSEOULDROP a non-exclusive license to display that content in the app. We may remove content that is fraudulent, offensive, or unrelated.",
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
