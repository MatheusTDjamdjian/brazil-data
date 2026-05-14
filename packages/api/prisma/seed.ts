import { PrismaClient } from '@prisma/client';

interface DemoConversation {
  title: string;
  userMessage: string;
  assistantText: string;
  toolName?: string;
}

const CONVERSAS_DEMO: DemoConversation[] = [
  {
    title: 'CPF 111.444.777-35 é válido?',
    userMessage: 'O CPF 111.444.777-35 é válido?',
    assistantText: '**111.444.777-35** é um CPF **válido**.',
    toolName: 'validar_documento',
  },
  {
    title: 'CEP 01310-100',
    userMessage: 'Endereço do CEP 01310-100',
    assistantText:
      '**CEP 01310-100**: Avenida Paulista, Bela Vista, São Paulo/SP. _(fonte: brasilapi)_',
    toolName: 'consultar_cep',
  },
  {
    title: 'Atividade do CNAE 6201-5/01',
    userMessage: 'Que atividade é o CNAE 6201-5/01?',
    assistantText:
      '**CNAE 6201501**: Desenvolvimento de programas de computador sob encomenda\nClasse 6201-5: Desenvolvimento de programas de computador sob encomenda\nSeção J: Informação e Comunicação',
    toolName: 'consultar_cnae',
  },
  {
    title: 'Feriados nacionais de 2026',
    userMessage: 'Liste os feriados nacionais de 2026',
    assistantText: [
      '**Feriados nacionais de 2026** (3):',
      '',
      '- **2026-01-01** — Confraternização mundial',
      '- **2026-04-21** — Tiradentes',
      '- **2026-05-01** — Dia do trabalho',
    ].join('\n'),
    toolName: 'consultar_feriados_nacionais',
  },
  {
    title: 'Como funciona?',
    userMessage: 'ajuda',
    assistantText: [
      'Posso consultar dados públicos brasileiros para você. Tente perguntar:',
      '',
      '- **CNPJ**: "Qual a situação do CNPJ 11.222.333/0001-81?"',
      '- **Simples Nacional**: "O CNPJ 11.222.333/0001-81 é optante do Simples?"',
      '- **CEP**: "Endereço do CEP 01310-100"',
    ].join('\n'),
  },
];

const DEMO_USER_ID = 'demo';

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('\n  Seed — populando conversas de exemplo\n');

  const prisma = new PrismaClient();
  await prisma.$connect();

  try {
    const existentes = await prisma.conversation.count({ where: { userId: DEMO_USER_ID } });
    if (existentes > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `  ℹ ${existentes} conversa(s) demo já existem — seed é idempotente, nada a fazer.\n`,
      );
      return;
    }

    let criadas = 0;
    for (const c of CONVERSAS_DEMO) {
      const conv = await prisma.conversation.create({
        data: { userId: DEMO_USER_ID, title: c.title },
      });
      await prisma.message.create({
        data: { conversationId: conv.id, role: 'user', content: c.userMessage },
      });
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          role: 'assistant',
          content: c.assistantText,
          ...(c.toolName ? { toolCalls: [{ name: c.toolName }] } : {}),
        },
      });
      criadas += 1;
    }
    // eslint-disable-next-line no-console
    console.log(`  ✓ ${criadas} conversa(s) demo criadas (userId=${DEMO_USER_ID}).\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('\n  ✗ Seed falhou: ' + (err as Error).message + '\n');
  process.exit(1);
});
