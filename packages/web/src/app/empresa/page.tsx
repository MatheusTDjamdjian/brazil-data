import { AppNav } from '@/components/AppNav';
import { CnpjForm } from '@/components/CnpjForm';
import { Card, CardContent } from '@/components/ui/card';

const EXEMPLOS = ['11.222.333/0001-81', '19.131.243/0001-97'];

export default function EmpresaIndexPage(): React.ReactElement {
  return (
    <div className="min-h-screen flex flex-col">
      <AppNav />
      <main className="container max-w-2xl py-10 flex-1">
        <h1 className="text-2xl font-bold tracking-tight">Análise de empresa</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Digite um CNPJ para gerar uma ficha consolidada com situação cadastral, CNAE, quadro
          societário, Simples Nacional e alertas determinísticos.
        </p>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <CnpjForm />
          </CardContent>
        </Card>

        <div className="mt-6">
          <p className="text-xs text-muted-foreground">Exemplos:</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {EXEMPLOS.map((c) => (
              <li key={c}>
                <a
                  href={`/empresa/${c.replace(/\D/g, '')}`}
                  className="inline-flex rounded-md border bg-card px-3 py-1.5 font-mono text-xs hover:border-primary hover:bg-accent"
                >
                  {c}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
