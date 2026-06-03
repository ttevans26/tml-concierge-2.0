/**
 * Tiny zero-dependency validator. We could pull zod from esm.sh, but cold-start
 * matters more than DX here — keep the surface intentionally small.
 *
 * Usage:
 *   const schema = obj({
 *     url: str({ min: 1, max: 2048 }),
 *     trip_id: optional(uuid()),
 *   });
 *   const parsed = schema.parse(await req.json()); // throws ValidationError
 */

export class ValidationError extends Error {
  status = 400 as const;
  constructor(public field: string, msg: string) {
    super(`${field}: ${msg}`);
    this.name = "ValidationError";
  }
}

export interface Validator<T> {
  parse(input: unknown, path?: string): T;
}

export const str = (opts: { min?: number; max?: number; pattern?: RegExp } = {}): Validator<string> => ({
  parse(v, path = "value") {
    if (typeof v !== "string") throw new ValidationError(path, "must be a string");
    if (opts.min !== undefined && v.length < opts.min) throw new ValidationError(path, `min length ${opts.min}`);
    if (opts.max !== undefined && v.length > opts.max) throw new ValidationError(path, `max length ${opts.max}`);
    if (opts.pattern && !opts.pattern.test(v)) throw new ValidationError(path, `must match ${opts.pattern}`);
    return v;
  },
});

export const num = (opts: { min?: number; max?: number; int?: boolean } = {}): Validator<number> => ({
  parse(v, path = "value") {
    if (typeof v !== "number" || Number.isNaN(v)) throw new ValidationError(path, "must be a number");
    if (opts.int && !Number.isInteger(v)) throw new ValidationError(path, "must be an integer");
    if (opts.min !== undefined && v < opts.min) throw new ValidationError(path, `min ${opts.min}`);
    if (opts.max !== undefined && v > opts.max) throw new ValidationError(path, `max ${opts.max}`);
    return v;
  },
});

export const bool = (): Validator<boolean> => ({
  parse(v, path = "value") {
    if (typeof v !== "boolean") throw new ValidationError(path, "must be a boolean");
    return v;
  },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const uuid = (): Validator<string> => str({ pattern: UUID_RE });

const URL_RE = /^https?:\/\/[^\s]+$/i;
export const url = (opts: { max?: number } = {}): Validator<string> =>
  str({ pattern: URL_RE, max: opts.max ?? 2048 });

export const oneOf = <T extends string>(values: readonly T[]): Validator<T> => ({
  parse(v, path = "value") {
    if (typeof v !== "string" || !values.includes(v as T))
      throw new ValidationError(path, `must be one of ${values.join(", ")}`);
    return v as T;
  },
});

export const arr = <T>(item: Validator<T>, opts: { min?: number; max?: number } = {}): Validator<T[]> => ({
  parse(v, path = "value") {
    if (!Array.isArray(v)) throw new ValidationError(path, "must be an array");
    if (opts.min !== undefined && v.length < opts.min) throw new ValidationError(path, `min length ${opts.min}`);
    if (opts.max !== undefined && v.length > opts.max) throw new ValidationError(path, `max length ${opts.max}`);
    return v.map((x, i) => item.parse(x, `${path}[${i}]`));
  },
});

export const optional = <T>(inner: Validator<T>): Validator<T | undefined> => ({
  parse(v, path = "value") {
    if (v === undefined || v === null) return undefined;
    return inner.parse(v, path);
  },
});

export const any = (): Validator<unknown> => ({ parse: (v) => v });

export const obj = <S extends Record<string, Validator<unknown>>>(
  shape: S,
): Validator<{ [K in keyof S]: ReturnType<S[K]["parse"]> }> => ({
  parse(v, path = "value") {
    if (!v || typeof v !== "object" || Array.isArray(v))
      throw new ValidationError(path, "must be an object");
    const out: Record<string, unknown> = {};
    for (const [k, validator] of Object.entries(shape)) {
      out[k] = validator.parse((v as Record<string, unknown>)[k], path === "value" ? k : `${path}.${k}`);
    }
    return out as { [K in keyof S]: ReturnType<S[K]["parse"]> };
  },
});