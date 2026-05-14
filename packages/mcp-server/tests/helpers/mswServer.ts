import { setupServer } from 'msw/node';

/** Servidor MSW único, compartilhado entre os testes. */
export const mswServer = setupServer();
