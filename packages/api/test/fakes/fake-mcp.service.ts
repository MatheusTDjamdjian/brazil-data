import { Injectable } from '@nestjs/common';

/**
 * Fake do McpService para testes — evita carregar o pacote ESM
 * `@brazil-data/mcp-server` dentro do runtime CJS do Jest.
 *
 * Implementa apenas as 4 tools que aparecem nos e2e: `validar_documento`
 * (algoritmo CPF/CNPJ local, sem rede), e `consultar_cnpj` / `consultar_cep`
 * (fazem fetch real — usamos o mock global de `globalThis.fetch` do e2e).
 *
 * Cobertura real das tools fica nos testes Vitest do pacote mcp-server.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolHandler = any;

// ---------- Helpers reaproveitados (cópia mínima do mcp-server) ----------

function cleanDigits(s: string): string {
  return s.replace(/\D/g, '');
}

function validarCpf(cpf: string): boolean {
  const c = cleanDigits(cpf);
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(c[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(c[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(c[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(c[10]);
}

function formatarCpf(cpf: string): string {
  const c = cleanDigits(cpf);
  if (c.length !== 11) return cpf;
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9, 11)}`;
}

function formatarCnpj(cnpj: string): string {
  const c = cleanDigits(cnpj);
  if (c.length !== 14) return cnpj;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12, 14)}`;
}

// ---------- Tool fakes ----------

const validarDocumentoFake: AnyToolHandler = {
  name: 'validar_documento',
  description: 'Valida CPF ou CNPJ (fake).',
  async execute({ documento, tipo }: { documento: string; tipo: 'cpf' | 'cnpj' | 'auto' }) {
    const digits = cleanDigits(documento);
    const tipoReal = tipo === 'auto' ? (digits.length <= 11 ? 'cpf' : 'cnpj') : tipo;
    if (tipoReal === 'cpf') {
      const valido = validarCpf(digits);
      return {
        valido,
        tipo: 'cpf',
        formatado: formatarCpf(digits),
        ...(valido ? {} : { motivo: 'Dígitos verificadores não conferem.' }),
      };
    }
    return { valido: false, tipo: 'cnpj', formatado: formatarCnpj(digits) };
  },
  compactarParaLLM(out: unknown) {
    return out;
  },
};

const consultarCnpjFake: AnyToolHandler = {
  name: 'consultar_cnpj',
  description: 'Consulta CNPJ (fake).',
  async execute({ cnpj }: { cnpj: string }) {
    const limpo = cleanDigits(cnpj);
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${limpo}`);
    if (res.status === 404) throw new Error(`CNPJ ${limpo} não encontrado.`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const api = (await res.json()) as Record<string, unknown>;
    return {
      cnpj: formatarCnpj(limpo),
      razaoSocial: api.razao_social ?? '?',
      nomeFantasia: api.nome_fantasia || undefined,
      situacao: api.descricao_situacao_cadastral ?? '?',
      situacaoData: (api.data_situacao_cadastral as string) ?? undefined,
      dataAbertura: (api.data_inicio_atividade as string) ?? undefined,
      cnaePrincipal: {
        codigo: String(api.cnae_fiscal ?? ''),
        descricao: (api.cnae_fiscal_descricao as string) ?? '',
      },
      cnaesSecundarios: [],
      endereco: {
        municipio: (api.municipio as string) ?? undefined,
        uf: (api.uf as string) ?? undefined,
      },
      porte: api.porte,
      capitalSocial: api.capital_social,
      simples: {
        optante: api.opcao_pelo_simples === true,
        dataOpcao: (api.data_opcao_pelo_simples as string) ?? undefined,
        dataExclusao: (api.data_exclusao_do_simples as string) ?? undefined,
        mei: api.opcao_pelo_mei === true,
      },
      socios: Array.isArray(api.qsa)
        ? (api.qsa as Array<Record<string, unknown>>).map((s) => ({
            nome: s.nome_socio,
            qualificacao: s.qualificacao_socio,
          }))
        : [],
    };
  },
  compactarParaLLM(out: unknown) {
    return out;
  },
};

const consultarCepFake: AnyToolHandler = {
  name: 'consultar_cep',
  description: 'Consulta CEP (fake).',
  async execute({ cep }: { cep: string }) {
    const limpo = cleanDigits(cep);
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${limpo}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const api = (await res.json()) as Record<string, string>;
    return {
      cep: `${limpo.slice(0, 5)}-${limpo.slice(5)}`,
      logradouro: api.street ?? '',
      bairro: api.neighborhood ?? '',
      cidade: api.city ?? '',
      uf: api.state ?? '',
      fonte: 'brasilapi',
    };
  },
  compactarParaLLM(out: unknown) {
    return out;
  },
};

// consultar_simples_nacional delega para consultarCnpj
const consultarSimplesNacionalFake: AnyToolHandler = {
  name: 'consultar_simples_nacional',
  description: 'Consulta Simples (fake).',
  async execute({ cnpj }: { cnpj: string }) {
    const full = (await consultarCnpjFake.execute({ cnpj })) as {
      cnpj: string;
      razaoSocial: string;
      simples: { optante: boolean; dataOpcao?: string; dataExclusao?: string; mei: boolean };
    };
    return {
      cnpj: full.cnpj,
      razaoSocial: full.razaoSocial,
      optante: full.simples.optante,
      dataOpcao: full.simples.dataOpcao,
      dataExclusao: full.simples.dataExclusao,
      mei: full.simples.mei,
    };
  },
  compactarParaLLM(out: unknown) {
    return out;
  },
};

// Placeholders mínimos para as outras 5 — não exercitadas pelos e2e mas
// satisfazem health/list().
function placeholder(name: string): AnyToolHandler {
  return {
    name,
    description: `placeholder (${name})`,
    async execute() {
      throw new Error(`${name} não é exercitado no e2e da api`);
    },
    compactarParaLLM(out: unknown) {
      return out;
    },
  };
}

const ALL_FAKES: AnyToolHandler[] = [
  validarDocumentoFake,
  consultarCnpjFake,
  consultarCepFake,
  consultarSimplesNacionalFake,
  placeholder('consultar_cnae'),
  placeholder('consultar_banco'),
  placeholder('consultar_ddd'),
  placeholder('consultar_feriados_nacionais'),
  placeholder('calcular_prazo_fiscal'),
];

@Injectable()
export class FakeMcpService {
  private toolMap = new Map<string, AnyToolHandler>(ALL_FAKES.map((t) => [t.name, t]));

  async onModuleInit(): Promise<void> {
    /* no-op — não carrega @brazil-data/mcp-server */
  }

  list(): AnyToolHandler[] {
    return ALL_FAKES;
  }

  get(name: string): AnyToolHandler | undefined {
    return this.toolMap.get(name);
  }
}
