import StudentsClient from '@/components/crm/StudentsClient';

export const dynamic = 'force-dynamic';

export default function StudentsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  return <StudentsClient initialStatus={searchParams.status} />;
}
