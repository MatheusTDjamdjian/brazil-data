import { ContabilService } from './contabil.service';

// Fake mínimo do McpService — só o get('consultar_cnpj') que retorna
// uma tool com execute() configurável por teste.
function makeMcpFake(cnpjResponse: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tool: any = {
    name: 'consultar_cnpj',
    description: '',
    execute: async () => cnpjResponse,
    compactarParaLLM: (x: unknown) => x,
  };
  return {
    get: (name: string) => (name === 'consultar_cnpj' ? tool : undefined),
    list: () => [tool],
  };
}

describe('ContabilService.analiseEmpresa', () => {
  function baseCnpj(overrides: Record<string, unknown> = {}) {
    return {
      cnpj: '11.222.333/0001-81',
      razaoSocial: 'EMPRESA TESTE',
      nomeFantasia: 'TESTE',
      situacao: 'ATIVA',
      situacaoData: '2010-01-15',
      dataAbertura: '2010-01-15',
      cnaePrincipal: { codigo: '6201501', descricao: 'Software' },
      cnaesSecundarios: [],
      porte: 'DEMAIS',
      capitalSocial: 100000,
      endereco: { municipio: 'SAO PAULO', uf: 'SP' },
      contato: {},
      simples: { optante: false, mei: false },
      socios: [{ nome: 'A', qualificacao: 'Sócio' }],
      ...overrides,
    };
  }

  it('cria ficha completa com idade calculada e sem alertas críticos', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new ContabilService(makeMcpFake(baseCnpj()) as any);
    const r = await svc.analiseEmpresa('11.222.333/0001-81');
    expect(r.razaoSocial).toBe('EMPRESA TESTE');
    expect(r.situacao.ativa).toBe(true);
    expect(r.fundacao.idadeAnos).toBeGreaterThanOrEqual(15);
    expect(r.alertas.find((a) => a.tipo === 'situacao_irregular')).toBeUndefined();
    expect(r.geradoEm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('marca situacao_irregular como erro quando não-ATIVA', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new ContabilService(makeMcpFake(baseCnpj({ situacao: 'SUSPENSA' })) as any);
    const r = await svc.analiseEmpresa('11.222.333/0001-81');
    const a = r.alertas.find((x) => x.tipo === 'situacao_irregular');
    expect(a).toBeDefined();
    expect(a?.nivel).toBe('erro');
    expect(r.situacao.ativa).toBe(false);
  });

  it('marca MEI ao invés de optante quando ambos true', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new ContabilService(
      makeMcpFake(
        baseCnpj({ simples: { optante: true, dataOpcao: '2020-01-01', mei: true } }),
      ) as any,
    );
    const r = await svc.analiseEmpresa('11.222.333/0001-81');
    expect(r.alertas.find((a) => a.tipo === 'mei')).toBeDefined();
    expect(r.alertas.find((a) => a.tipo === 'optante_simples')).toBeUndefined();
  });

  it('marca optante_simples com data quando optante=true e mei=false', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new ContabilService(
      makeMcpFake(
        baseCnpj({ simples: { optante: true, dataOpcao: '2018-03-15', mei: false } }),
      ) as any,
    );
    const r = await svc.analiseEmpresa('11.222.333/0001-81');
    const a = r.alertas.find((x) => x.tipo === 'optante_simples');
    expect(a?.mensagem).toContain('2018-03-15');
  });

  it('flag empresa_nova quando < 1 ano', async () => {
    const hoje = new Date();
    const data = new Date(hoje);
    data.setMonth(data.getMonth() - 3);
    const dataIso = data.toISOString().slice(0, 10);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new ContabilService(makeMcpFake(baseCnpj({ dataAbertura: dataIso })) as any);
    const r = await svc.analiseEmpresa('11.222.333/0001-81');
    expect(r.alertas.find((a) => a.tipo === 'empresa_nova')).toBeDefined();
  });

  it('flag empresa_antiga quando >= 25 anos', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new ContabilService(makeMcpFake(baseCnpj({ dataAbertura: '1990-01-15' })) as any);
    const r = await svc.analiseEmpresa('11.222.333/0001-81');
    expect(r.alertas.find((a) => a.tipo === 'empresa_antiga')).toBeDefined();
  });

  it('flag sem_capital quando 0 ou ausente', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new ContabilService(makeMcpFake(baseCnpj({ capitalSocial: 0 })) as any);
    const r = await svc.analiseEmpresa('11.222.333/0001-81');
    const a = r.alertas.find((x) => x.tipo === 'sem_capital');
    expect(a).toBeDefined();
    expect(a?.nivel).toBe('atencao');
  });

  it('flag socio_unico só para portes não-MICRO', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new ContabilService(
      makeMcpFake(
        baseCnpj({ porte: 'DEMAIS', socios: [{ nome: 'A', qualificacao: 'Sócio' }] }),
      ) as any,
    );
    const r = await svc.analiseEmpresa('11.222.333/0001-81');
    expect(r.alertas.find((a) => a.tipo === 'socio_unico')).toBeDefined();
  });
});
