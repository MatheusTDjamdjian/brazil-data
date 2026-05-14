import { calcularPrazoFiscal } from './calcularPrazoFiscal.js';
import { consultarBanco } from './consultarBanco.js';
import { consultarCep } from './consultarCep.js';
import { consultarCnae } from './consultarCnae.js';
import { consultarCnpj } from './consultarCnpj.js';
import { consultarDdd } from './consultarDdd.js';
import { consultarFeriadosNacionais } from './consultarFeriadosNacionais.js';
import { consultarSimplesNacional } from './consultarSimplesNacional.js';
import { validarDocumento } from './validarDocumento.js';
import type { AnyToolHandler } from './types.js';

export {
  calcularPrazoFiscal,
  consultarBanco,
  consultarCep,
  consultarCnae,
  consultarCnpj,
  consultarDdd,
  consultarFeriadosNacionais,
  consultarSimplesNacional,
  validarDocumento,
};
export type * from './types.js';

/** Lista de todas as ferramentas registradas no servidor MCP. */
export const tools: AnyToolHandler[] = [
  // Gerais
  consultarCep,
  consultarCnpj,
  validarDocumento,
  // Contábeis
  consultarCnae,
  consultarSimplesNacional,
  consultarBanco,
  consultarDdd,
  consultarFeriadosNacionais,
  calcularPrazoFiscal,
];

/** Mapa nome → handler. */
export const toolMap = new Map<string, AnyToolHandler>(tools.map((t) => [t.name, t]));
