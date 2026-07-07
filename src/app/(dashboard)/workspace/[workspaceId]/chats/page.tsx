import ChatView from '@/components/chat/chat-view'

interface PageProps {
  params: Promise<{ workspaceId: string }>
}

export const metadata = { title: 'Chats' }

export default async function ChatsPage({ params }: PageProps) {
  const { workspaceId } = await params
  return <ChatView workspaceId={workspaceId} />
}
