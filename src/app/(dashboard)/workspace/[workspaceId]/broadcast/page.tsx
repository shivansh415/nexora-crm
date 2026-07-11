import BroadcastClient from './broadcast-client'

interface PageProps {
  params: Promise<{ workspaceId: string }>
}

export const metadata = { title: 'Broadcast' }

export default async function BroadcastPage({ params }: PageProps) {
  const { workspaceId } = await params
  return <BroadcastClient workspaceId={workspaceId} />
}
