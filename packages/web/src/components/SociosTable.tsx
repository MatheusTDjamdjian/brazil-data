import type { Socio } from '@/lib/types';

export function SociosTable({ socios }: { socios: Socio[] }): React.ReactElement {
  if (!socios || socios.length === 0) {
    return <p className="text-sm text-muted-foreground italic">Nenhum sócio cadastrado no QSA.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Nome</th>
            <th className="px-3 py-2 font-medium">Qualificação</th>
            <th className="px-3 py-2 font-medium">Entrada</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {socios.map((s, i) => (
            <tr key={`${s.nome}-${i}`}>
              <td className="px-3 py-2 font-medium">{s.nome}</td>
              <td className="px-3 py-2 text-muted-foreground">{s.qualificacao ?? '—'}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {s.dataEntrada ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
