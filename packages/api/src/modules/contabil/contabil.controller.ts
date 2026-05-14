import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { ContabilService } from './contabil.service';

const Input = z.object({
  cnpj: z.string().min(1, 'cnpj é obrigatório').max(20),
});

@Controller('contabil')
export class ContabilController {
  constructor(private readonly contabil: ContabilService) {}

  /**
   * POST /contabil/analise-empresa
   * Body: { cnpj: string }
   *
   * Endpoint puramente determinístico (sem LLM): consulta CNPJ na BrasilAPI
   * via tool MCP e devolve uma análise consolidada com alertas para o contador.
   */
  @Post('analise-empresa')
  async analise(@Body() body: unknown) {
    const parsed = Input.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'Validação falhou',
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    return this.contabil.analiseEmpresa(parsed.data.cnpj);
  }
}
