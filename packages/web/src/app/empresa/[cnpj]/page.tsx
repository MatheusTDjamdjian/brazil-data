import { notFound } from 'next/navigation';
import { AppNav } from '@/components/AppNav';
import { CnpjForm } from '@/components/CnpjForm';
import { EmpresaCard } from '@/components/EmpresaCard';
import { Card, CardContent } from '@/components/ui/card';
import { getAnaliseEmpresa, NotFoundError } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ cnpj: string }>;
}

export default async function EmpresaPage({ params }: PageProps): Promise<React.ReactElement> {
  const { cnpj } = await params;

  let data;
  let errorMsg: string | null = null;
  try {
    data = await getAnaliseEmpresa(cnpj);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    errorMsg = (e as Error).message;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav />
      <main className="container max-w-3xl py-8 flex-1">
        <div className="mb-6">
          <CnpjForm defaultValue={cnpj} />
        </div>

        {errorMsg ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">✗ {errorMsg}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Verifique se a API está rodando em <code className="font-mono">localhost:3001</code>
                .
              </p>
            </CardContent>
          </Card>
        ) : data ? (
          <EmpresaCard data={data} />
        ) : null}
      </main>
    </div>
  );
}
