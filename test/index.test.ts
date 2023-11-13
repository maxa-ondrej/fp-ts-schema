import { either, option } from 'fp-ts'
import * as D from '../src/index'
import { pipe } from 'fp-ts/lib/function'
import { Either } from 'fp-ts/lib/Either'

const shouldBe = <T>(decoder: D.Decoder<T>, input: unknown, output: T): void => {
  const result = decoder.decode(input)
  if (either.isLeft(result)) {
    fail(`Decoder failed with error: ${result.left.message}`)
  }
  expect(result.right).toStrictEqual(output)
}
const shouldFail = <T>(decoder: D.Decoder<T>, input: unknown): void => {
  const result = decoder.decode(input)
  if (either.isRight(result)) {
    fail(`Decoder succeeded with value: ${JSON.stringify(result.right)}`)
  }
  expect(either.isLeft(result)).toBe(true)
}

// Check defined
test('checkDefined fails when given an undefined value', () => {
  expect(() => D.checkDefined(null)).toThrow(D.DecoderError)
  expect(() => D.checkDefined(undefined)).toThrow(D.DecoderError)
})
test('checkDefined succeeds when given a defined value', () => {
  expect(() => D.checkDefined('test')).not.toThrow(D.DecoderError)
  expect(() => D.checkDefined(5)).not.toThrow(D.DecoderError)
  expect(() => D.checkDefined(true)).not.toThrow(D.DecoderError)
  expect(() => D.checkDefined({})).not.toThrow(D.DecoderError)
  expect(() => D.checkDefined([])).not.toThrow(D.DecoderError)
})

//
// Decoders
//
const primitiveTest = <T>(
  name: string,
  decoder: D.Decoder<T>,
  values: { success: T[], failure: unknown[] }
): void => {
  test(`${name} succeeds when given the correct type`, () => {
    values.success.forEach($ => shouldBe(decoder, $, $))
  })
  test(`${name} fails when given a wrong type`, () => {
    [...values.failure, {}, []].forEach($ => shouldFail(decoder, $))
  })
  test(`${name} fails when given null or undefined`, () => {
    shouldFail(decoder, null)
    shouldFail(decoder, undefined)
  })
}

// Bad decoder
test('D.badDecoder fails with the given error', () => {
  const badDecoder = D.createDecoder({
    forceDecode: () => {
      throw new Error('test')
    }
  });
  const result = badDecoder.decode(5)
  if (either.isRight(result)) {
    fail(`Decoder succeeded with value: ${JSON.stringify(result.right)}`)
  }
  expect(either.isLeft(result)).toBe(true)
  expect(result.left.message).toBe('Invalid data')
});
test('D.badDecoder inside array fails with the given error', () => {
  const badDecoder: D.Decoder<never> = {
    decode: () => either.left(new Error('test')) as Either<D.DecoderError, never>,
    is: (data): data is never => false,
    andThen: () => D.never,
  } as const;
  const arr = D.array(badDecoder)
  const result = arr.decode([5])
  if (either.isRight(result)) {
    fail(`Decoder succeeded with value: ${JSON.stringify(result.right)}`)
  }
  expect(either.isLeft(result)).toBe(true)
  expect(result.left.message).toBe('Invalid data')
});

// Null
test(`D.null succeeds when given a null`, () => {
  shouldBe(D.null, null, null);
})
test(`D.null fails when given a wrong type`, () => {
  shouldFail(D.null, 1);
  shouldFail(D.null, "1");
  shouldFail(D.null, undefined);
  shouldFail(D.null, NaN);
});

// String
primitiveTest('D.string', D.string, {
  success: ['test', ''], failure: [5, true]
})

// Number
primitiveTest('D.number', D.number, {
  success: [5, 0], failure: ['test', false]
})

// Booleans
primitiveTest('D.boolean', D.boolean, {
  success: [true, false], failure: ['test', 5]
})

// Nullable
test('D.nullable succeeds when given null or the correct type', () => {
  shouldBe(D.nullable(D.string), null, option.none)
  shouldBe(D.nullable(D.string), 'test', option.some('test'))
})
test('D.nullable fails when given undefined', () => {
  shouldFail(D.nullable(D.string), undefined)
})

// Succeed
test('D.succeed succeeds with the given value', () => {
  shouldBe(D.succeed(5), null, 5)
  shouldBe(D.oneOf(D.string, D.succeed("test")), NaN, 'test')
})

// Never
test('D.never fails with the given value', () => {
  shouldFail(D.never, null)
  shouldFail(D.oneOf(D.string, D.never), NaN)
  shouldBe(D.oneOf(D.string, D.never), 'test', 'test')
})

// Literal
test('D.literal succeeds when given the correct type', () => {
  shouldBe(D.literal('test'), 'test', 'test')
  shouldBe(D.literal(5), 5, 5)
  shouldBe(D.literal(true), true, true)
})
test('D.literal fails when given a different value', () => {
  shouldFail(D.literal('test'), '')
  shouldFail(D.literal('test'), 'bar')
  shouldFail(D.literal(5), '')
  shouldFail(D.literal(5), 3)
  shouldFail(D.literal(true), false)
  shouldFail(D.literal(true), '')
  shouldFail(D.literal(true), 7)
})
test('D.literal fails when given a wrong type', () => {
  shouldFail(D.literal('test'), [])
  shouldFail(D.literal('test'), {})
})
test('D.literal fails when given null or undefined', () => {
  shouldFail(D.literal('test'), null)
  shouldFail(D.literal('test'), undefined)
})

// One of
test('D.oneOf succeeds when given one of the permitted types', () => {
  shouldBe(D.oneOf(D.number, D.string), 'test', 'test')
  shouldBe(D.oneOf(D.number, D.string), 5, 5)
  shouldBe(D.oneOf(D.number, D.nullable(D.string)), null, option.none)
  shouldBe(D.oneOf(D.number, D.nullable(D.string)), 'test', option.some('test'))
  shouldBe(D.oneOf(D.number, D.nullable(D.string)), 5, 5)
})
test('D.oneOf fails when given a non-listed type', () => {
  shouldFail(D.oneOf(D.string), 5)
  shouldFail(D.oneOf(D.string, D.number), undefined)
  shouldFail(D.oneOf(D.string, D.number), null)
})

// All of
test('D.allOf succeeds when given one all needed', () => {
  shouldBe(D.allOf(D.object({ a: D.number }), D.object({ b: D.string })), { a: 5, b: 'test' }, { a: 5, b: 'test' })
  shouldBe(D.allOf(D.object({ a: D.object({ a: D.number }) }), D.object({ b: D.string })), { a: { a: 5 }, b: 'test' }, { a: { a: 5 }, b: 'test' })
  shouldBe(D.allOf(D.object({ a: D.object({ a: D.number, c: D.boolean }) }), D.object({ a: D.object({ b: D.string, c: D.boolean }) })), { a: { a: 5, b: 'test', c: true } }, { a: { a: 5, b: 'test', c: true } })
})
test('D.allOf fails when at least one is missing', () => {
  shouldFail(D.allOf(D.object({ a: D.number }), D.object({ b: D.string })), { a: 5 })
  shouldFail(D.allOf(D.object({ a: D.number }), D.object({ b: D.string })), { b: 'test' })
  shouldFail(D.allOf(D.object({ a: D.number }), D.object({ b: D.string })), undefined)
  shouldFail(D.allOf(D.object({ a: D.number }), D.object({ b: D.string })), null)
})

// Literal union
test('D.literalUnion succeeds when given one of the specified literals', () => {
  shouldBe(D.literalUnion('a', 5), 'a', 'a')
  shouldBe(D.literalUnion('a', 5), 5, 5)
})
test('D.literalUnion fails when given a non-listed literal', () => {
  shouldFail(D.literalUnion('a', 5), true)
  shouldFail(D.literalUnion('a', 5), 'b')
})
test('D.literalUnion fails when given an unsupported type', () => {
  shouldFail(D.literalUnion('a', 5), {})
  shouldFail(D.literalUnion('a', 5), [])
})
test('D.literalUnion fails when given null or undefined', () => {
  shouldFail(D.literalUnion('a', 5), null)
  shouldFail(D.literalUnion('a', 5), undefined)
})

// Regex
test('D.regex succeeds when regex is satisfied', () => {
  shouldBe(D.regex(/^[a-z]+$/), 'test', 'test')
})

test('D.regex fails when regex is not satisfied', () => {
  shouldFail(D.regex(/^[a-z]+$/), 'TEST!')
  shouldFail(D.regex(/^[a-z]+$/), null)
  shouldFail(D.regex(/^[a-z]+$/), undefined)
})

// Array
test('D.array succeeds when given an array of the correct type', () => {
  shouldBe(D.array(D.unknown), [], [])
  shouldBe(D.array(D.number), [1, 2, 3], [1, 2, 3])
})
test('D.array fails when given an array of wrong types', () => {
  shouldFail(D.array(D.number), ['test', 'test'])
  shouldFail(D.array(D.number), [1, 2, 3, ''])
})
test('D.array fails when given something that is not an array', () => {
  shouldFail(D.array(D.unknown), {})
  shouldFail(D.array(D.unknown), 5)
  shouldFail(D.array(D.unknown), 'test')
})
test('D.array fails when given null or undefined', () => {
  shouldFail(D.array(D.unknown), undefined)
  shouldFail(D.array(D.unknown), null)
})

// Tuple
test('D.tuple succeeds when given a tuple with at least the required length', () => {
  shouldBe(D.tuple(D.number, D.string), [5, ''], [5, ''])
})
test('D.tuple crops the tuple if it is longer than the required length', () => {
  shouldBe(D.tuple(D.number, D.string), [5, '', true], [5, ''])
})
test('D.tuple fails when given a non-array type', () => {
  shouldFail(D.tuple(D.unknown), { foo: 'bar' })
  shouldFail(D.tuple(D.unknown), {})
})
test('D.tuple fails when given a shorter tuple', () => {
  shouldFail(D.tuple(D.unknown, D.unknown), [5])
})
test('D.tuple fails when given null or undefined', () => {
  shouldFail(D.tuple(D.unknown), null)
  shouldFail(D.tuple(D.unknown), undefined)
})

// Record
test('D.record succeeds when given a record of the right type', () => {
  shouldBe(D.record(D.number), { foo: 1, bar: 5 }, { bar: 5, foo: 1 })
  shouldBe(D.record(D.unknown), {}, {})
})
test('D.record fails when given a record of the wrong type', () => {
  shouldFail(D.record(D.number), { foo: 1, bar: 'test' })
  shouldFail(D.record(D.unknown), { [Symbol()]: 1 })
  shouldFail(D.record(D.unknown), [])
})
test('D.record fails when given null or undefined', () => {
  shouldFail(D.record(D.unknown), null)
  shouldFail(D.record(D.unknown), undefined)
})

// Key-value pairs
test('D.keyValuePairs succeeds when given a dict', () => {
  shouldBe(D.keyValuePairs(D.number), { a: 1, b: 2 }, [['a', 1], ['b', 2]])
  shouldBe(D.keyValuePairs(D.unknown), {}, [])
})
test('D.keyValuePairs fails when it gets an invalid record', () => {
  shouldFail(D.keyValuePairs(D.number), { a: 'a', b: 'b' })
  shouldFail(D.keyValuePairs(D.unknown), [])
  shouldFail(D.keyValuePairs(D.unknown), 'test')
  shouldFail(D.keyValuePairs(D.unknown), 5)
})
test('D.keyValuePairs fails when given null or undefined', () => {
  shouldFail(D.keyValuePairs(D.unknown), null)
  shouldFail(D.keyValuePairs(D.unknown), undefined)
})

// Object
test('D.object succeeds when it has all required fields', () => {
  shouldBe(D.object({ foo: D.string, bar: D.number }), { foo: 'test', bar: 5 }, { foo: 'test', bar: 5 })
})
test('D.object succeeds and crops when given some of the optional fields', () => {
  shouldBe(D.object({ foo: D.optional(D.string) }), { foo: 'test', bar: 5 }, { foo: option.some('test') })
})
test('D.object succeeds and crops when given some of the optional fields', () => {
  shouldBe(D.object({ foo: D.string }), { foo: 'test', bar: 5 }, { foo: 'test' })
})
test('D.object fails when given null or undefined', () => {
  shouldFail(D.object({ foo: D.optional(D.string) }), null)
  shouldFail(D.object({ foo: D.optional(D.string) }), undefined)
})

// Recursive
test('D.recursive succeeds when used correctly', () => {
  // We need to specify the types beforehand
  type User = [string, string, User[]]

  const userDecoder: D.Decoder<User> =
    D.tuple(D.string, D.string, D.array(D.recursive(() => userDecoder)))

  const users: User = [
    'Brad',
    'Pitt',
    [
      ['Johnny', 'Depp', [['Al', 'Pacino', []]]],
      ['Leonardo', 'DiCaprio', []]
    ]
  ]

  shouldBe(userDecoder, users, users)

  interface Category {
    name: string,
    subcategories: Category[]
  }

  const categoryDecoder: D.Decoder<Category> = D.object({
    name: D.string,
    subcategories: D.array(D.recursive(() => categoryDecoder))
  })

  const categoryDecoder_: D.Decoder<Category> = D.recursive(() =>
    D.object({
      name: D.string,
      subcategories: D.array(categoryDecoder_)
    })
  )

  const categories = {
    name: 'Electronics',
    subcategories: [
      {
        name: 'Computers',
        subcategories: [
          { name: 'Desktops', subcategories: [] },
          { name: 'Laptops', subcategories: [] }
        ]
      },
      { name: 'Fridges', subcategories: [] }
    ]
  }

  shouldBe(categoryDecoder, categories, categories)
  shouldBe(categoryDecoder_, categories, categories)
})

//
// Methods
//

// maybe
test('Decoder.decode returns the value when the decoder succeeds', () => {
  const result = D.string.decode('test')
  if (either.isLeft(result)) {
    fail(`Decoder failed with error: ${result.left.message}`)
  }
  expect(result.right).toStrictEqual('test')
  const result2 = D.array(D.string).decode(['test'])
  if (either.isLeft(result2)) {
    fail(`Decoder failed with error: ${result2.left.message}`)
  }
  expect(result2.right).toStrictEqual(['test'])
})
test('Decoder.decode returns error when the decoder fails', () => {
  expect(either.isLeft(D.string.decode(5))).toStrictEqual(true)
  expect(either.isLeft(D.array(D.string).decode('test'))).toStrictEqual(true)
})

// andThen
test('Decoder.andThen changes the type after parsed', () => {
  shouldBe(D.number.andThen($ => $.toString()), 5, '5')
  const objectDecoder = D.object({
    a: D.number,
    b: D.optional(D.number),
  }).andThen($ => ({
    a: $.a.toString(),
    b: pipe($.b, option.map($ => $.toString()))
  }))
  shouldBe(objectDecoder, { a: 5, b: 10 }, { a: '5', b: option.some('10') })
  shouldBe(objectDecoder, { a: 5 }, { a: '5', b: option.none })
})
test('Decoder.andThen fails when the transformer fails', () => {
  shouldFail(D.unknown.andThen(_ => { throw new D.DecoderError() }), '')
})
test('Decoder.andThen fails when the decoder fails', () => {
  shouldFail(D.number.andThen(Number.prototype.toString), 'test')
  shouldFail(D.number.andThen($ => $.toString()), 'test')
})

// is
test('Decoder.is returns true for correct type', () => {
  expect(D.string.is('test')).toBe(true)
  expect(D.object({
    a: D.number,
    b: D.optional(D.number)
  }).is({ a: 2 })).toBe(true)
})
test('Decoder.is returns false for wrong type', () => {
  expect(D.string.is(5)).toBe(false)
  expect(D.array(D.unknown).is({})).toBe(false)
  expect(D.unknown.is({})).toBe(true)
})

test('DecodeError path of a recursive type is correct', () => {

  const categories: any = {
    name: 'Electronics',
    subcategories: [
      {
        name: 'Computers',
        subcategories: [
          { name: 'Desktops', subcategories: [] },
          { name: 1, subcategories: [] }
        ]
      },
      { name: 'Fridges', subcategories: [] }
    ]
  }

  interface Category {
    name: string,
    subcategories: Category[]
  }

  const categoryDecoder: D.Decoder<Category> = D.object({
    name: D.string,
    subcategories: D.array(D.recursive(() => categoryDecoder))
  })

  const categoryDecoder_: D.Decoder<Category> = D.recursive(() =>
    D.object({
      name: D.string,
      subcategories: D.array(categoryDecoder_)
    })
  )

  const result = categoryDecoder_.decode(categories);
  if (either.isLeft(result)) {
    expect(result.left.message).toStrictEqual("subcategories.0.subcategories.1.name: This is not a string: 1")
  } else {
    fail("Expected error")
  }
})
