import { AppNav } from '@/components/AppNav';
import { ChatInterface } from '@/components/ChatInterface';

interface PageProps {
  searchParams: Promise<{ q?: string; conversation?: string }>;
}

export default async function ChatPage({ searchParams }: PageProps): Promise<React.ReactElement> {
  const { q, conversation } = await searchParams;

  return (
    <div className="flex h-screen flex-col">
      <AppNav />
      <div className="flex-1 min-h-0">
        <ChatInterface initialMessage={q} initialConversationId={conversation} />
      </div>
    </div>
  );
}
