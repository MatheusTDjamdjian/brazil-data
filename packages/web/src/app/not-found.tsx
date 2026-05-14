import Link from 'next/link';
import { AppNav } from '@/components/AppNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function NotFound(): React.ReactElement {
  return (
    <div className="min-h-screen flex flex-col">
      <AppNav />
      <main className="container max-w-2xl py-16 flex-1">
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <p className="font-mono text-5xl font-bold tracking-tight text-muted-foreground">404</p>
            <h2 className="mt-4 text-lg font-semibold">Página não encontrada</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              O link que você seguiu não existe (mais).
            </p>
            <Button asChild className="mt-6">
              <Link href="/">Voltar para o início</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
