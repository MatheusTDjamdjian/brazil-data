import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './common/env';
import { logger } from './common/logger';

async function bootstrap(): Promise<void> {
  let env;
  try {
    env = loadEnv();
  } catch (e) {
    process.stderr.write('\n✗ Configuração inválida:\n' + (e as Error).message + '\n\n');
    process.stderr.write(
      '  Dica: o projeto tem defaults sensatos. Se quer customizar, copie\n' +
        '  .env.example para .env e ajuste só o que precisa.\n\n',
    );
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn'],
  });
  // CORS aberto para o frontend local; em prod ajustar.
  app.enableCors({ origin: true, credentials: false });

  await app.listen(env.API_PORT);
  logger.info({ port: env.API_PORT, agent: 'deterministic-zero-llm' }, 'api.ready');
}

bootstrap().catch((err) => {
  const msg = (err as Error).message ?? String(err);
  process.stderr.write('\n✗ Falha ao iniciar a API: ' + msg + '\n\n');
  if (/ECONNREFUSED.*5432|getaddrinfo|database/i.test(msg)) {
    process.stderr.write(
      '  Parece um problema de conexão com o Postgres. Verifique se o Docker\n' +
        '  está rodando (make up) ou se DATABASE_URL aponta para um banco no ar.\n\n',
    );
  }
  process.exit(1);
});
