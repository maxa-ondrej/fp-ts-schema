import type { Either, Right } from 'fp-ts/lib/Either';
import type { Option } from 'fp-ts/lib/Option';

// fp-ts adapters
const right = <A>(a: A): Either<never, A> => ({ _tag: 'Right', right: a })
const left = <E>(l: E): Either<E, never> => ({ _tag: 'Left', left: l })
const isRight = <E, A>(fa: Either<E, A>): fa is Right<A> => fa._tag === 'Right'
const none: Option<never> = { _tag: 'None' }
const some = <A>(a: A): Option<A> => ({ _tag: 'Some', value: a })
const fromNullable = <A>(a: A | null | undefined): Option<A> => a == null ? none : some(a)

interface Decode<D> {
  readonly forceDecode: (data: unknown) => D
}

export interface Decoder<D> {
  readonly decode: (data: unknown) => Either<DecoderError, ReturnType<Decode<D>['forceDecode']>>
  readonly is: (data: unknown) => data is D
  readonly andThen: <T>(transformer: (data: D) => T) => Decoder<T>
}

export type ValidationResult<D> =
  | { type: 'ok', data: D }
  | { type: 'error', error: DecoderError }

export type Output<T extends Decoder<any>> = T extends Decoder<infer D> ? D : never

export const createDecoder = <D>(decoder: Decode<D>): Decoder<D> => ({
  decode: (data) => {
    try {
      return right(decoder.forceDecode(data));
    } catch (e) {
      return left(e instanceof DecoderError ? e : new DecoderError('Invalid data'));
    }
  },
  is: (data): data is D => {
    try {
      decoder.forceDecode(data)
      return true
    } catch {
      return false
    }
  },
  andThen: (transformer) => {
    return createDecoder({
      forceDecode: (data: unknown) => transformer(decoder.forceDecode(data))
    })
  }
})

export class DecoderError extends SyntaxError {
  path: string[]
  constructor(message?: string, path: string[] = []) {
    super(message)
    this.name = 'DecoderError'
    this.path = path
    Object.setPrototypeOf(this, new.target.prototype)

    if (this.path.length === 1) {
      this.message = `${this.path[0]}: ${this.message}`
    } else if (this.path.length > 1) {
      this.message = `${this.path[0]}.${this.message}`
    }
  }
}

const forceDecode = <T>(decoder: Decoder<T>, data: unknown): T => {
  const result = decoder.decode(data);
  if (isRight(result)) {
    return result.right;
  }
  throw result.left;
}

const forceDecodeWithPath = <T>(decoder: Decoder<T>, data: unknown, pathPart: string): T => {
  try {
    return forceDecode(decoder, data)
  } catch (e) {
    if (e instanceof DecoderError) {
      throw new DecoderError(e.message, [pathPart, ...e.path])
    } else {
      throw e
    }
  }
}

const show = (data: unknown): string => JSON.stringify(data, null, 2)

/**
 * Throws if data is null or undefined
 */
export const checkDefined = (data: unknown): data is null | undefined => {
  if (data == null) throw new DecoderError('This value is not there')
  return false
}

/**
 * If the data is null return null
 * else, pass to the decoder where 'checkDefined'
 * fails only when data is undefined
 */
export const nullable = <D>(decoder: Decoder<D>): Decoder<Option<D>> => oneOf(decoder, null_)
  .andThen(fromNullable);

/**
 * A decoder that always return the same value
 * Useful for fallback values
 */
export const succeed = <T>(value: T): Decoder<T> => createDecoder({
  forceDecode: () => value
})

/**
 * A decoder that always fails. Useful for overriding existing decoders.
 */
export const never: Decoder<never> = createDecoder({
  forceDecode: () => {
    throw new DecoderError('This field must never be present')
  }
})

const primitiveDecoder = <D>(
  dataType: string,
  condition: (data: unknown) => data is D
): Decoder<D> => createDecoder({
  forceDecode: (data) => {
    checkDefined(data)
    if (!condition(data)) {
      throw new DecoderError(`This is not ${dataType}: ${show(data)}`)
    }
    return data
  }
})

//
// Primitives
//

export const unknown = createDecoder({
  forceDecode: (data) => data
})

const null_ = createDecoder({
  forceDecode: (data) => {
    if (data === null) {
      return data
    } else {
      throw new DecoderError('Provided value is not null.')
    }
  }
})
export { null_ as null }

export const string = primitiveDecoder<string>(
  'a string', ($): $ is string => typeof $ === 'string'
)

export const number = primitiveDecoder<number>(
  'a number', ($): $ is number => typeof $ === 'number' && Number.isFinite($)
)

export const boolean = primitiveDecoder<boolean>(
  'a boolean', ($): $ is boolean => typeof $ === 'boolean'
)

export const literal = <D extends string | number | boolean>(literal: D): Decoder<D> => createDecoder({
  forceDecode: (data) => {
    checkDefined(data)
    if (data !== literal) {
      throw new DecoderError(
        `Data does not match the literal. Expected: '${literal as string}', actual value: '${show(data)}'`
      )
    }
    return data as D
  }
})

export const oneOf = <D extends readonly any[]>(
  ...decoders: { [K in keyof D]: Decoder<D[K]> }
): Decoder<D[number]> => createDecoder({
  forceDecode: (data) => {
    const errors = []
    for (const decoder of decoders) {
      const result = decoder.decode(data)
      if (isRight(result)) {
        return result.right
      }
      errors.push(result.left.message)
    }

    throw new DecoderError(`None of the decoders worked:\n${show(errors)}`)
  }
})

type AllOf<D extends Decoder<MapObject<any>>[]> = D extends [infer A, ...infer B]
  ? (A extends Decoder<MapObject<any>>
    ? (B extends Decoder<MapObject<any>>[]
      ? Output<A> & AllOf<B> : unknown) : unknown)
  : unknown;

const deepMerge = <A extends Record<PropertyKey, unknown>, B extends Record<PropertyKey, unknown>>(a: A, b: B): A & B => {
  const result = { ...a } as A & B;
  for (const [keyRaw, value] of Object.entries(b)) {
    const key = keyRaw as PropertyKey & keyof (A & B);
    if (key in result) {
      if (typeof value === 'object' && typeof result[key] === 'object') {
        result[key] = deepMerge(result[key] as Record<string, unknown>, value as Record<string, unknown>) as any;
      } else {
        result[key] = value as any;
      }
    } else {
      result[key] = value as any;
    }
  }
  return result;
}

export const allOf = <D extends Decoder<MapObject<any>>[]>(...decoders: D) => createDecoder({
  forceDecode: (data) => decoders.reduce((acc, decoder) => deepMerge(acc, forceDecode(decoder, data)), {}) as AllOf<D>,
});

export const literalUnion = <D extends ReadonlyArray<string | number | boolean>>(...decoders: D): Decoder<D[number]> =>
  oneOf(...decoders.map(literal))

export const regex = (regex: RegExp): Decoder<string> =>
  string.andThen(data => {
    if (!regex.test(data)) throw new DecoderError(`Data '${data}' does not satisfy the regex '${regex.toString()}'`)

    return data
  })

//
// Arrays
//

function checkArrayType(data: unknown): asserts data is any[] {
  if (!Array.isArray(data)) throw new DecoderError(`This is not an array: ${show(data)}`)
}

export const array = <D>(decoder: Decoder<D>): Decoder<D[]> => createDecoder({
  forceDecode: (data) => {
    checkDefined(data)
    checkArrayType(data)
    return data.map((x: unknown, i) => forceDecodeWithPath(decoder, x, i.toString()))
  }
})

export const tuple = <D extends readonly unknown[]>(
  ...decoders: { [K in keyof D]: Decoder<D[K]> }
): Decoder<D> => createDecoder({
  forceDecode: (data) => {
    checkDefined(data)
    checkArrayType(data)
    if (decoders.length > data.length) {
      throw new DecoderError(
        `The tuple is not long enough. ${decoders.length} > ${data.length}`
      )
    }

    return decoders.map((decoder, index) =>
      forceDecodeWithPath(decoder, data[index], index.toString())
    ) as any as D
  }
})

//
// Dicts
//

function checkDictType(data: unknown): asserts data is Record<string, unknown> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new DecoderError(`This is not an object: ${show(data)}`)
  } else if (Object.keys(data).some($ => typeof $ !== 'string') || Object.getOwnPropertySymbols(data).length > 0) {
    throw new DecoderError(`Not all keys in this object are strings: ${show(data)}`)
  }
}

export const record = <D>(decoder: Decoder<D>): Decoder<Record<string, D>> => createDecoder({
  forceDecode: (data) => {
    checkDefined(data)
    checkDictType(data)
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, forceDecodeWithPath(decoder, value, key)])
    )
  }
})

export const keyValuePairs = <D>(decoder: Decoder<D>): Decoder<Array<[string, D]>> => createDecoder({
  forceDecode: (data) => Object.entries(forceDecode(record(decoder), data))
})

//
// Objects
//

export type DecoderRecord = Record<PropertyKey, Decoder<any>>
type ObjectTypeRequired<D extends DecoderRecord> = { [K in keyof D]: Output<D[K]> }
type ObjectTypeOptional<D extends DecoderRecord> = { [K in keyof D]: Option<Output<D[K]>> }

const required = <D extends DecoderRecord>(
  struct: D
): Decoder<ObjectTypeRequired<D>> => createDecoder({
  forceDecode: (data) => {
    checkDictType(data)

    const parsed: Partial<ObjectTypeRequired<D>> = {}

    for (const key in struct) {
      if (data[key] === undefined) throw new DecoderError(`Object missing required property '${key}'`)
      parsed[key] = forceDecodeWithPath(struct[key], data[key], key)
    }

    return parsed as ObjectTypeRequired<D>
  }
})

const partial = <D extends DecoderRecord>(
  struct: D
): Decoder<ObjectTypeOptional<D>> => createDecoder({
  forceDecode: (data) => {
    checkDictType(data)

    const parsed: Partial<ObjectTypeOptional<D>> = {}

    for (const key in struct) {
      if (data[key] === undefined) {
        parsed[key] = none
      } else {
        parsed[key] = some(forceDecodeWithPath(struct[key], data[key], key))
      }
    }

    return parsed as ObjectTypeOptional<D>
  }
})

export const structuredObject = <D extends DecoderRecord, E extends DecoderRecord>(
  struct: {
    required?: D
    optional?: E
  }
): Decoder<ObjectTypeRequired<D> & ObjectTypeOptional<E>> => createDecoder({
  forceDecode: (data) => {
    checkDefined(data)

    const result: Partial<ObjectTypeRequired<D> & ObjectTypeOptional<E>> = {}
    if (struct.required !== undefined) {
      Object.assign(result, forceDecode(required(struct.required), data))
    }
    if (struct.optional !== undefined) {
      Object.assign(result, forceDecode(partial(struct.optional), data))
    }
    return result as ObjectTypeRequired<D> & ObjectTypeOptional<E>
  }
})

export type Optional<D> = {
  optional: unknown;
  decoder: Decoder<D>;
};

export type ObjectRecord = Record<PropertyKey, Optional<any> | Decoder<any>>;

export const optional = <D>(decoder: Decoder<D>): Optional<D> => ({
  optional: true,
  decoder,
});

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export declare type MapObject<D extends ObjectRecord> = PartialBy<
  {
    [K in keyof D]: D[K] extends Optional<infer T> ? Option<T> : D[K] extends Decoder<infer T> ? T : never;
  },
  {
    [key in keyof D]: D[key] extends Optional<unknown> ? key : never;
  }[keyof D]
>;

export const object = <D extends ObjectRecord>(struct: D) =>
  structuredObject(Object.entries(struct)
    .reduce((acc, [key, value]) => {
      if ('optional' in value) {
        acc.optional[key] = value.decoder;
      } else {
        acc.required[key] = value;
      }
      return acc;
    }, {
      optional: {} as DecoderRecord,
      required: {} as DecoderRecord
    }),
  ).andThen((x) => x as {
    [K in keyof D]: D[K] extends Optional<infer T> ? Option<T> : D[K] extends Decoder<infer T> ? T : never;
  });

export const recursive = <D>(decoder: () => Decoder<D>): Decoder<D> => createDecoder({
  forceDecode: (data) => {
    return forceDecode(decoder(), data)
  }
})