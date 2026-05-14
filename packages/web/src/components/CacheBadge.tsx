import { Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function CacheBadge(): React.ReactElement {
  return (
    <Badge variant="secondary" title="Resposta servida do cache da aplicação">
      <Database className="h-3 w-3" />
      <span>cache</span>
    </Badge>
  );
}
