/** Remove tudo que não é dígito. */
export function cleanDigits(s: string): string {
  return s.replace(/\D/g, '');
}

/** Valida CPF (11 dígitos) pelos dois dígitos verificadores. */
export function validarCpf(cpf: string): boolean {
  const c = cleanDigits(cpf);
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false; // todos iguais

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(c[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(c[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(c[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(c[10]);
}

/** Valida CNPJ (14 dígitos) pelos dois dígitos verificadores. */
export function validarCnpj(cnpj: string): boolean {
  const c = cleanDigits(cnpj);
  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false;

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(c[i]) * w1[i]!;
  let d1 = sum % 11;
  d1 = d1 < 2 ? 0 : 11 - d1;
  if (d1 !== Number(c[12])) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(c[i]) * w2[i]!;
  let d2 = sum % 11;
  d2 = d2 < 2 ? 0 : 11 - d2;
  return d2 === Number(c[13]);
}

/** Formata CPF para o padrão 000.000.000-00. */
export function formatarCpf(cpf: string): string {
  const c = cleanDigits(cpf);
  if (c.length !== 11) return cpf;
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9, 11)}`;
}

/** Formata CNPJ para o padrão 00.000.000/0000-00. */
export function formatarCnpj(cnpj: string): string {
  const c = cleanDigits(cnpj);
  if (c.length !== 14) return cnpj;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12, 14)}`;
}

/** Formata CEP para o padrão 00000-000. */
export function formatarCep(cep: string): string {
  const c = cleanDigits(cep);
  if (c.length !== 8) return cep;
  return `${c.slice(0, 5)}-${c.slice(5)}`;
}
