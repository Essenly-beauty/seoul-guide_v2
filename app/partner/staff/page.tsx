import { PartnerStaff } from '@/components/partner/partner-staff';
export default async function StaffPage({ searchParams }: { searchParams: Promise<{ staff?: string; view?: string }> }) {
  const params = await searchParams;
  return <PartnerStaff initialStaffId={params.staff} initialTab={params.view === 'schedule' ? 'schedule' : 'profile'} />;
}
