export type Resultado<T> =
  | { ok: true; valor: T }
  | { ok: false; erro: string };
