import { Calendar, Mail, MapPin, Phone, Wallet } from 'lucide-react';
import { AlertasList } from './AlertasList';
import { SociosTable } from './SociosTable';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { AnaliseEmpresa } from '@/lib/types';

function formatMoney(v?: number): string {
  if (v === undefined || v === null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateBr(iso?: string): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}): React.ReactElement {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono text-sm' : 'text-sm'}>{value}</dd>
    </div>
  );
}

export function EmpresaCard({ data }: { data: AnaliseEmpresa }): React.ReactElement {
  const enderecoLinha = [
    data.endereco.logradouro,
    data.endereco.numero,
    data.endereco.complemento,
    data.endereco.bairro,
  ]
    .filter(Boolean)
    .join(', ');
  const cidade = [data.endereco.municipio, data.endereco.uf].filter(Boolean).join('/');

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{data.razaoSocial}</h2>
              {data.nomeFantasia ? (
                <p className="text-sm text-muted-foreground">{data.nomeFantasia}</p>
              ) : null}
              <p className="mt-1 font-mono text-xs text-muted-foreground">{data.cnpj}</p>
            </div>
            <Badge variant={data.situacao.ativa ? 'success' : 'destructive'}>
              {data.situacao.descricao}
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Fundação"
              value={
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatDateBr(data.fundacao.data)}
                  {data.fundacao.idadeAnos !== undefined ? (
                    <span className="text-muted-foreground">({data.fundacao.idadeAnos} anos)</span>
                  ) : null}
                </span>
              }
            />
            <Field label="Porte" value={data.porte ?? '—'} />
            <Field
              label="Capital social"
              value={
                <span className="flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatMoney(data.capitalSocial)}
                </span>
              }
            />
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                CNAE principal
              </dt>
              <dd className="text-sm">
                <span className="font-mono">{data.cnaePrincipal.codigo}</span>
                {data.cnaePrincipal.descricao ? (
                  <span> · {data.cnaePrincipal.descricao}</span>
                ) : null}
              </dd>
            </div>
          </dl>

          {data.cnaesSecundarios.length > 0 ? (
            <div className="mt-4">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                CNAEs secundários
              </dt>
              <ul className="mt-2 flex flex-wrap gap-1">
                {data.cnaesSecundarios.slice(0, 8).map((c) => (
                  <li key={c.codigo}>
                    <Badge variant="outline" className="font-mono">
                      {c.codigo}
                    </Badge>
                  </li>
                ))}
                {data.cnaesSecundarios.length > 8 ? (
                  <li>
                    <Badge variant="secondary">+{data.cnaesSecundarios.length - 8} mais</Badge>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Endereço e contato
          </h3>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Endereço"
              value={
                <span className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>
                    {enderecoLinha || '—'}
                    {cidade ? <span className="block">{cidade}</span> : null}
                    {data.endereco.cep ? (
                      <span className="block font-mono text-xs text-muted-foreground">
                        CEP {data.endereco.cep}
                      </span>
                    ) : null}
                  </span>
                </span>
              }
            />
            <Field
              label="Telefone"
              value={
                data.contato?.telefone1 ? (
                  <span className="flex items-center gap-1.5 font-mono">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    {data.contato.telefone1}
                  </span>
                ) : (
                  '—'
                )
              }
            />
            <Field
              label="Email"
              value={
                data.contato?.email ? (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    {data.contato.email}
                  </span>
                ) : (
                  '—'
                )
              }
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Simples Nacional
          </h3>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Optante"
              value={
                data.simples.optante ? (
                  <Badge variant="success">SIM</Badge>
                ) : (
                  <Badge variant="secondary">NÃO</Badge>
                )
              }
            />
            <Field label="Data de opção" value={formatDateBr(data.simples.dataOpcao)} />
            <Field
              label="MEI"
              value={data.simples.mei ? <Badge variant="success">SIM</Badge> : <span>—</span>}
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Quadro societário (QSA)
          </h3>
        </CardHeader>
        <CardContent>
          <SociosTable socios={data.socios} />
        </CardContent>
      </Card>

      {data.alertas.length > 0 ? (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Alertas ({data.alertas.length})
            </h3>
          </CardHeader>
          <CardContent>
            <AlertasList alertas={data.alertas} />
          </CardContent>
        </Card>
      ) : null}

      <p className="text-center text-[11px] text-muted-foreground">
        Gerado em{' '}
        <time dateTime={data.geradoEm}>{new Date(data.geradoEm).toLocaleString('pt-BR')}</time>
        {' · '}fonte: BrasilAPI · análise determinística (zero-LLM)
      </p>
    </div>
  );
}
