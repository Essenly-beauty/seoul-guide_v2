import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal/legal-article";

export const metadata: Metadata = { title: "Privacy Policy — MYSEOULDROP" };

// NOTE: Draft copy. Must pass legal review before public launch.
const SECTIONS = [
  { heading: "What we collect", body: [
    "Account basics (name, email, and — only if you verify one — your phone number), your beauty profile (hair and skin type, concerns, interests), your saved places, ratings and reviews, and — only while the map is open and with your permission — your device location.",
    "If you sign in with Google, Google shares your name, email address and profile picture with us. We request nothing else from your Google account.",
  ]},
  { heading: "How we use it", body: [
    "To personalize recommendations and show nearby places on the map. We do not sell your personal data, and we do not share it with venues — MYSEOULDROP currently has no booking features.",
    "We send you marketing email only if you ticked the optional box at sign-up. Service email (sign-in links, password resets, account notices) is not marketing.",
  ]},
  { heading: "Location", body: [
    "Map location is used on-device to sort places by distance. It is requested only when you tap the locate button, never on page load. Your coordinates are not stored on our servers and are not included in error reports, performance measurements or links. You can decline the permission and browse from a default area instead.",
  ]},
  { heading: "Cookies and on-device storage", body: [
    "We set only strictly necessary cookies: the sign-in session cookies managed by our authentication provider (Supabase Auth). There are no analytics, advertising or tracking cookies, so no cookie banner is needed.",
    "Before you sign in, your saved places, ratings and profile answers live only in your browser's local storage on your device. Signing in merges them into your account; clearing site data removes them. Anonymous performance measurements (page-load timings, no cookies or identifiers) are sent to help us keep the map fast.",
  ]},
  { heading: "Who processes your data and where (international transfers)", body: [
    "MYSEOULDROP is operated from the Republic of Korea. To run the service we entrust storage and processing to the following providers under their standard data-processing terms — this means your data is stored outside Korea (and, for EU/UK visitors, outside the EEA/UK):",
    "Supabase — database and authentication hosting; servers in the United States (AWS us-east-1); processes account, profile, saved-place, rating, review and feedback data, plus anonymized error reports and performance measurements; kept for as long as described under Retention.",
    "Vercel — web hosting, serverless functions and a worldwide content-delivery network; processes request logs (IP address, user agent, requested page) needed to deliver and secure the site; request logs are kept by Vercel for a limited period under its own retention rules.",
    "Google — sign-in only, if you choose \"Continue with Google\"; Google's own privacy policy governs what Google records about that sign-in.",
  ]},
  { heading: "Retention", body: [
    "Account data (profile, saved places, ratings, reviews) is kept while your account is active and removed immediately when you delete the account. Feedback you send us is kept without your account link after deletion.",
    "Diagnostic data — client error reports and performance measurements — is not linked to your account and is kept for up to 12 months, after which it is deleted.",
  ]},
  { heading: "Your rights and how to exercise them", body: [
    "You can access and download a copy of your data, correct your profile, or permanently delete your account at any time from Settings → Data & privacy — deletion is immediate and removes your account, profile, saved places, ratings and reviews. You can withdraw marketing consent at any time by contacting us via the Support page; withdrawing consent does not affect the service.",
    "If you believe we have mishandled your personal information you may lodge a complaint with the Personal Information Protection Commission (PIPC) of Korea (privacy.go.kr, hotline 118). Visitors in the EU/UK may also contact their local data protection authority. Please contact us first — we respond to requests within 30 days.",
  ]},
  { heading: "Sensitive data", body: [
    "Skin and hair characteristics you share are used only for recommendations. We never infer or store medical conditions.",
  ]},
  { heading: "Changes", body: [
    "When this policy changes we update the date at the top; material changes are announced in the app.",
  ]},
];

export default function PrivacyPage() {
  return (
    <LegalArticle
      title="Privacy Policy"
      updated="Sep 20, 2026"
      intro="This policy explains what MYSEOULDROP collects, why, and the choices you have — written for travelers, not lawyers."
      sections={SECTIONS}
    />
  );
}
