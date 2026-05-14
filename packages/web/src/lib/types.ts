/**
 * Tipos do AgentEvent — espelho do que a API (NestJS) emite via SSE.
 * Mantemos uma cópia aqui pra não acoplar o frontend ao bundle do backend.
 */

export type IntentType =
  | 'cnpj_lookup'
  | 'simples_check'
  | 'cep_lookup'
  | 'cpf_validate'
  | 'cnae_lookup'
  | 'ddd_lookup'
  | 'banco_lookup'
  | 'feriados_lookup'
  | 'prazo_fiscal'
  | 'help'
  | 'unknown';

export type AgentEvent =
  | { type: 'intent'; intent: IntentType; matchedBy?: string }
  | { type: 'tool_call'; toolName: string; input: Record<string, unknown>; cached: boolean }
  | {
      type: 'tool_result';
      toolName: string;
      durationMs: number;
      isError: boolean;
      cached: boolean;
      full: unknown;
      compact: unknown;
    }
  | { type: 'text'; text: string }
  | {
      type: 'done';
      conversationId: string;
      messageId: string;
      intent: IntentType;
      toolCallsCount: number;
      durationMs: number;
      cached: boolean;
    }
  | { type: 'error'; message: string };

// ---- /contabil/analise-empresa ----

export type NivelAlerta = 'info' | 'atencao' | 'erro';
export type TipoAlerta =
  | 'situacao_irregular'
  | 'empresa_nova'
  | 'empresa_antiga'
  | 'mei'
  | 'optante_simples'
  | 'sem_capital'
  | 'socio_unico';

export interface Alerta {
  tipo: TipoAlerta;
  nivel: NivelAlerta;
  mensagem: string;
}

export interface Socio {
  nome: string;
  qualificacao?: string;
  dataEntrada?: string;
}

export interface AnaliseEmpresa {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  situacao: { descricao: string; ativa: boolean; desde?: string };
  fundacao: { data?: string; idadeAnos?: number; idadeMeses?: number };
  porte?: string;
  capitalSocial?: number;
  cnaePrincipal: { codigo: string; descricao: string };
  cnaesSecundarios: Array<{ codigo: string; descricao: string }>;
  endereco: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
  };
  contato?: { telefone1?: string; telefone2?: string; email?: string };
  simples: { optante: boolean; dataOpcao?: string; dataExclusao?: string; mei: boolean };
  socios: Socio[];
  alertas: Alerta[];
  geradoEm: string;
}

// ---- /conversations ----

export interface ConversationSummary {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  toolCalls: unknown;
  createdAt: string;
}

export interface ConversationDetail {
  id: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
}
