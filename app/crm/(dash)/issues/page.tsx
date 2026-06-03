import DonorsClient from '@/components/crm/DonorsClient';

export const dynamic = 'force-dynamic';

export default function IssuesPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  return <DonorsClient initialIssueType={searchParams.type} onlyIssues />;
}
