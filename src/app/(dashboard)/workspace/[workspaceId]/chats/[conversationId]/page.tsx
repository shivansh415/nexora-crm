import ChatView from '@/components/chat/chat-view'

interface PageProps {
  params: Promise<{ workspaceId: string; conversationId: string }>
}

export default async function ConversationPage({ params }: PageProps) {
  const { workspaceId, conversationId } = await params
  return <ChatView workspaceId={workspaceId} initialConversationId={conversationId} />
}
