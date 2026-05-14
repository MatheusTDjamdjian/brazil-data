import { fetchJson } from '../lib/http.js';
import { NotFoundError } from '../lib/errors.js';

const BASE = 'https://viacep.com.br/ws';

export interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
  gia?: string;
  ddd?: string;
  siafi?: string;
  /** ViaCEP devolve { erro: true } em CEP inexistente em vez de 404. */
  erro?: boolean | string;
}

export const viaCep = {
  async cep(cep8: string): Promise<ViaCepResponse> {
    const res = await fetchJson<ViaCepResponse>(`${BASE}/${cep8}/json/`);
    // ViaCEP retorna 200 + {erro:true} quando o CEP não existe.
    if (res.erro === true || res.erro === 'true') {
      throw new NotFoundError(`CEP ${cep8} não encontrado no ViaCEP.`, { cep: cep8 });
    }
    return res;
  },
};
