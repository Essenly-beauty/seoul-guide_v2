import type { Metadata } from 'next';
import { PartnerProvider } from '@/components/partner/partner-provider';
import { PartnerShell } from '@/components/partner/partner-shell';
import '@/components/partner/dashboard.css';

export const metadata: Metadata = { title: '가맹점 관리 | MYSEOULDROP', robots: { index: false, follow: false } };
export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return <PartnerProvider><PartnerShell>{children}</PartnerShell></PartnerProvider>;
}
