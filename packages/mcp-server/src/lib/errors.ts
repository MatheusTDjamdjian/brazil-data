/** Erro genérico de ferramenta — mensagens já em português, prontas para o usuário. */
export class ToolError extends Error {
  constructor(
    public readonly userMessage: string,
    public readonly meta: Record<string, unknown> = {},
  ) {
    super(userMessage);
    this.name = 'ToolError';
  }
}

/** Input do usuário não passou na validação local (formato, dígitos, etc). */
export class ValidationError extends ToolError {
  constructor(msg: string, meta?: Record<string, unknown>) {
    super(msg, meta);
    this.name = 'ValidationError';
  }
}

/** API externa devolveu erro (4xx/5xx) ou caiu o link. */
export class ExternalApiError extends ToolError {
  constructor(
    msg: string,
    public readonly status?: number,
    meta?: Record<string, unknown>,
  ) {
    super(msg, meta);
    this.name = 'ExternalApiError';
  }
}

/** Recurso não encontrado (CNPJ inexistente, CEP não cadastrado, etc). */
export class NotFoundError extends ToolError {
  constructor(msg: string, meta?: Record<string, unknown>) {
    super(msg, meta);
    this.name = 'NotFoundError';
  }
}

/** Tool atingiu o limite local de requisições. */
export class RateLimitError extends ToolError {
  constructor(
    msg: string,
    public readonly retryAfterMs: number,
    meta?: Record<string, unknown>,
  ) {
    super(msg, meta);
    this.name = 'RateLimitError';
  }
}
