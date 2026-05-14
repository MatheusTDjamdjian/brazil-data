import type { UnknownQuery } from '@/lib/api';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia(s)`;
}

export function UnknownList({ items }: { items: UnknownQuery[] }): React.ReactElement {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Todas as perguntas tiveram intent reconhecida — boa cobertura.
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y">
      {items.map((q) => (
        <li key={q.id} className="flex items-start justify-between gap-3 py-2">
          <p className="text-sm flex-1 break-words">&quot;{q.userMessage}&quot;</p>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {relativeTime(q.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
