import { fetchJson } from '../lib/http.js';

const BASE = 'https://brasilapi.com.br/api';

// ============================================================
// Tipos do payload da BrasilAPI (apenas os campos que usamos)
// ============================================================

export interface BrasilApiCep {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  service?: string;
  location?: {
    type?: string;
    coordinates?: { longitude?: string; latitude?: string };
  };
}

export interface BrasilApiCnaeRefSecundario {
  codigo: number;
  descricao: string;
}

export interface BrasilApiCnpjSocio {
  identificador_de_socio?: number;
  nome_socio?: string;
  cnpj_cpf_do_socio?: string;
  codigo_qualificacao_socio?: number;
  qualificacao_socio?: string;
  data_entrada_sociedade?: string;
  pais?: string;
  faixa_etaria?: string;
}

export interface BrasilApiCnpj {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  situacao_cadastral?: number;
  descricao_situacao_cadastral?: string;
  data_situacao_cadastral?: string;
  motivo_situacao_cadastral?: number;
  data_inicio_atividade?: string;
  cnae_fiscal?: number;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: BrasilApiCnaeRefSecundario[];
  natureza_juridica?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  ddd_telefone_1?: string;
  ddd_telefone_2?: string;
  email?: string;
  capital_social?: number;
  porte?: string;
  opcao_pelo_simples?: boolean;
  data_opcao_pelo_simples?: string | null;
  data_exclusao_do_simples?: string | null;
  opcao_pelo_mei?: boolean;
  qsa?: BrasilApiCnpjSocio[];
}

export interface BrasilApiCnae {
  id: number;
  descricao: string;
  grupo_id?: string;
  grupo_descricao?: string;
  divisao_id?: string;
  divisao_descricao?: string;
  secao_id?: string;
  secao_descricao?: string;
  classe_id?: string;
  classe_descricao?: string;
}

export interface BrasilApiBank {
  ispb?: string;
  name?: string;
  code: number;
  fullName?: string;
}

export interface BrasilApiDdd {
  state: string;
  cities: string[];
}

export interface BrasilApiFeriado {
  date: string; // ISO yyyy-mm-dd
  name: string;
  type: 'national' | string;
}

// ============================================================
// Endpoints
// ============================================================

export const brasilApi = {
  async cep(cep8: string): Promise<BrasilApiCep> {
    return fetchJson<BrasilApiCep>(`${BASE}/cep/v2/${cep8}`, { notFoundOk: true });
  },

  async cnpj(cnpj14: string): Promise<BrasilApiCnpj> {
    return fetchJson<BrasilApiCnpj>(`${BASE}/cnpj/v1/${cnpj14}`, { notFoundOk: true });
  },

  async cnae(codigo: string): Promise<BrasilApiCnae> {
    return fetchJson<BrasilApiCnae>(`${BASE}/cnae/v1/${codigo}`, { notFoundOk: true });
  },

  async banco(codigo: string): Promise<BrasilApiBank> {
    return fetchJson<BrasilApiBank>(`${BASE}/banks/v1/${codigo}`, { notFoundOk: true });
  },

  async ddd(ddd: string): Promise<BrasilApiDdd> {
    return fetchJson<BrasilApiDdd>(`${BASE}/ddd/v1/${ddd}`, { notFoundOk: true });
  },

  async feriados(ano: number): Promise<BrasilApiFeriado[]> {
    return fetchJson<BrasilApiFeriado[]>(`${BASE}/feriados/v1/${ano}`, {
      notFoundOk: true,
    });
  },
};
