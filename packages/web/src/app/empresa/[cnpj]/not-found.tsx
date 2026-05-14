import Link from 'next/link';
import { AppNav } from '@/components/AppNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function NotFound(): React.ReactElement {
  return (
    <div className="min-h-screen flex flex-col">
      <AppNav />
      <main className="container max-w-2xl py-12 flex-1">
        <Card>
          <CardContent className="pt-6 text-center">
            <h2 className="text-lg font-semibold">CNPJ não encontrado</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A BrasilAPI não tem registro desse CNPJ ou o número não passou na validação.
            </p>
            <Button asChild className="mt-4">
              <Link href="/empresa">Tentar outro CNPJ</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
