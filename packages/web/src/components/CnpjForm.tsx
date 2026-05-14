'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from './ui/button';

function cleanDigits(s: string): string {
  return s.replace(/\D/g, '');
}

export function CnpjForm({ defaultValue }: { defaultValue?: string }): React.ReactElement {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cleanDigits(value);
    if (clean.length !== 14) {
      setError(`CNPJ precisa ter 14 dígitos (recebi ${clean.length}).`);
      return;
    }
    setError(null);
    router.push(`/empresa/${clean}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="00.000.000/0000-00"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <Button type="submit">
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Analisar</span>
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </form>
  );
}
