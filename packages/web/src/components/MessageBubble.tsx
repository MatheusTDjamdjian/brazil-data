import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

export type Role = 'user' | 'assistant';

export interface MessageBubbleProps {
  role: Role;
  children?: React.ReactNode;
  /** Quando informado, renderiza como Markdown. */
  markdown?: string;
}

export function MessageBubble({
  role,
  children,
  markdown,
}: MessageBubbleProps): React.ReactElement {
  const isUser = role === 'user';
  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-card border rounded-bl-sm',
        )}
      >
        {markdown ? (
          <div className={cn('prose prose-sm max-w-none', isUser ? 'prose-invert' : '')}>
            <ReactMarkdown>{markdown}</ReactMarkdown>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
