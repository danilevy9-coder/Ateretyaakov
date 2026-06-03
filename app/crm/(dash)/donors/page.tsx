import DonorsClient from '@/components/crm/DonorsClient';

export const dynamic = 'force-dynamic';

export default function DonorsPage({
  searchParams,
}: {
  searchParams: { segment?: string; status?: string; type?: string };
}) {
  return (
    <DonorsClient
      initialSegment={searchParams.segment}
      initialStatus={searchParams.status}
      initialIssueType={searchParams.type}
    />
  );
}
