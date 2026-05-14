import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Concatena classes Tailwind, resolvendo conflitos. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Garante um user-id estável por navegador (para o header X-User-Id). */
export function getOrCreateUserId(): string {
  if (typeof window === 'undefined') return 'anonymous';
  const KEY = 'brazil-data.userId';
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = 'u_' + Math.random().toString(36).slice(2, 10);
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
