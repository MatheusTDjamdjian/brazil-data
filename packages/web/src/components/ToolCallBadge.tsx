'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface ToolCallBadgeProps {
  toolName: string;
  input: Record<string, unknown>;
  full?: unknown;
  durationMs?: number;
  cached?: boolean;
  isError?: boolean;
}

export function ToolCallBadge({
  toolName,
  input,
  full,
  durationMs,
  cached,
  isError,
}: ToolCallBadgeProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const variant = isError ? 'destructive' : cached ? 'secondary' : 'outline';

  return (
    <div className="my-1 inline-flex flex-col">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 group cursor-pointer text-left"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        <Badge variant={variant} className="font-mono">
          <Wrench className="h-3 w-3" />
          <span>{toolName}</span>
          {durationMs !== undefined ? (
            <span className="text-[10px] opacity-75">· {durationMs}ms</span>
          ) : null}
          {cached ? <span className="text-[10px]">· cache</span> : null}
          {isError ? <span className="text-[10px]">· erro</span> : null}
        </Badge>
      </button>
      {open ? (
        <pre
          className={cn(
            'mt-1 max-w-2xl overflow-x-auto rounded-md border bg-muted/40 p-2 text-[11px] font-mono leading-tight',
          )}
        >
          {JSON.stringify({ input, output: full }, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
