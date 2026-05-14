import Link from 'next/link';
import { ArrowRight, Github, Zap, Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const FEATURES = [
  {
    icon: Zap,
    title: 'Custo $0 por consulta',
    body: 'Agente determinístico baseado em regex/keywords — sem chave de API, sem tokens.',
  },
  {
    icon: Lock,
    title: '100% reprodutível',
    body: 'Mesma pergunta → mesma resposta, sempre. Auditável e previsível.',
  },
  {
    icon: Sparkles,
    title: 'Servidor MCP standalone',
    body: 'As 9 ferramentas são consumíveis via stdio JSON-RPC por Claude Desktop ou qualquer cliente MCP.',
  },
];

const EXAMPLES = [
  'Qual a situação do CNPJ 11.222.333/0001-81?',
  'O CNPJ 11.222.333/0001-81 é optante do Simples Nacional?',
  'Endereço completo do CEP 01310-100',
  'Que atividade é o CNAE 6201-5/01?',
  '15 dias úteis a partir de hoje?',
  'Liste os feriados nacionais de 2026',
];

export default function LandingPage(): React.ReactElement {
  return (
    <main className="min-h-full">
      <header className="border-b">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary" />
            <div>
              <p className="text-sm font-semibold leading-none">Assistente Contábil</p>
              <p className="text-[10px] text-muted-foreground">
                Dados públicos brasileiros · zero-LLM
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <a
                href="https://github.com/MatheusTDjamdjian/brazil-data"
                target="_blank"
                rel="noreferrer"
              >
                <Github className="h-4 w-4" />
                <span className="hidden sm:inline">GitHub</span>
              </a>
            </Button>
            <Button asChild size="sm">
              <Link href="/chat">
                Começar
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="container py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Pergunte em linguagem natural.
            <br />
            Receba dados públicos oficiais.
          </h1>
          <p className="mt-6 text-base text-muted-foreground sm:text-lg">
            CNPJ, CEP, CNAE, Simples Nacional, banco, DDD, feriados e prazos fiscais — consultados
            via servidor MCP, formatados em PT-BR. Sem chave de API, sem custo por consulta.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/chat">
                Começar agora
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a
                href="https://github.com/MatheusTDjamdjian/brazil-data#readme"
                target="_blank"
                rel="noreferrer"
              >
                Documentação
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className="container pb-16">
        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <CardContent className="pt-6">
                <f.icon className="mb-3 h-5 w-5 text-primary" />
                <h3 className="mb-1 text-sm font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container pb-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-4 text-center text-xl font-semibold">
            Exemplos do que você pode perguntar
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {EXAMPLES.map((q) => (
              <Link
                key={q}
                href={`/chat?q=${encodeURIComponent(q)}`}
                className="rounded-lg border bg-card px-3 py-2 text-sm shadow-sm transition-colors hover:border-primary hover:bg-accent"
              >
                {q}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="container py-6 text-center text-xs text-muted-foreground">
          MIT · Construído com NestJS, Next.js e o servidor MCP@brazil-data.
        </div>
      </footer>
    </main>
  );
}
