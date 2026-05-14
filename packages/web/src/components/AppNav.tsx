import Link from 'next/link';
import { Activity, Building2, MessageSquare, History, Github } from 'lucide-react';
import { HealthIndicator } from './HealthIndicator';
import { ThemeToggle } from './ThemeToggle';
import { Button } from './ui/button';

export function AppNav(): React.ReactElement {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 sticky top-0 z-10">
      <div className="container flex items-center justify-between gap-2 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary" />
          <span className="hidden text-sm font-semibold sm:inline">Assistente Contábil</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/chat">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Chat</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/empresa">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Empresa</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/conversations">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/metrics">
              <Activity className="h-4 w-4" />
              <span className="hidden md:inline">Métricas</span>
            </Link>
          </Button>
          <span className="mx-1 hidden h-4 w-px bg-border sm:inline-block" />
          <HealthIndicator />
          <ThemeToggle />
          <Button asChild variant="ghost" size="icon" aria-label="GitHub">
            <a
              href="https://github.com/MatheusTDjamdjian/brazil-data"
              target="_blank"
              rel="noreferrer"
            >
              <Github className="h-4 w-4" />
            </a>
          </Button>
        </nav>
      </div>
    </header>
  );
}
