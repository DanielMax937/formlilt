import { Workspace } from '@/components/workspace';
export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  return <Workspace id={(await params).sessionId} />;
}
