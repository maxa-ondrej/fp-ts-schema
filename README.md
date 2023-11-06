# 🧬 Fp-Ts Schema

Fp-Ts Schema is a fork of [schemawax](https://github.com/michaljanocko/schemawax) (a tool for creating typed decoders to help you get to the DNA of your data) implementing [fp-ts](https://gcanti.github.io/fp-ts/).

To add `@majkit/fp-ts-schema` to your project, do:

``` bash
# NPM
npm install @majkit/fp-ts-schema
# Pnpm
pnpm install @majkit/fp-ts-schema
# Yarn
yarn add @majkit/fp-ts-schema
```

> It is only **2.1 kB**!

## 📋 How to use

I recommend checking out some examples to get an idea of what this library can do for you. _(spoiler: a lot)_

**You can start in a couple of simple steps!**

Build a decoder:

``` ts
import * as D from 'schemawax'

const userDecoder = D.object({
  name: D.string,
  preferredName: D.nullable(D.string),
  emailVerified: D.boolean
})

// You can get the shape of the data into a type, use D.Output<…>
type User = D.Output<typeof userDecoder>
```

Get your data:

``` ts
// Usually, you would get the data using 'JSON.parse(response)' or something
const data = {
  name: 'Bob',
  preferredName: O.none,
  emailVerified: false
}
```

Decode your data:

``` ts
const parsed = userDecoder.decode(data)

if (parsed) {
  console.log(parsed)
} else {
  console.log('Failed to decode')
}
```

The decoders are fully typed so you can confidently use your data in TypeScript.

You can either delve into the documentation (highly recommended) or check out some of our quick [recipes](recipes/).

## 📄 Full documentation

- [🧬 Fp-Ts Schema](#-fp-ts-schema)
  - [📋 How to use](#-how-to-use)
  - [📄 Full documentation](#-full-documentation)
    - [Methods](#methods)
      - [_Decoder_`.decode`](#decoderdecode)
      - [_Decoder_`.is`](#decoderis)
    - [Primitives](#primitives)
      - [`D.string`](#dstring)
      - [`D.number`](#dnumber)
      - [`D.boolean`](#dboolean)
      - [`D.literal`](#dliteral)
      - [`D.literalUnion`](#dliteralunion)
      - [`D.regex`](#dregex)
      - [`D.nullable`](#dnullable)
      - [`D.succeed`](#dsucceed)
    - [Combinators](#combinators)
      - [`D.oneOf`](#doneof)
      - [`D.allOf`](#dallof)
      - [`D.tuple`](#dtuple)
      - [`D.array`](#darray)
      - [`D.record`](#drecord)
      - [`D.keyValuePairs`](#dkeyvaluepairs)
      - [`D.object`](#dobject)
      - [`D.structuredObject`](#dstructuredobject)
      - [`D.recursive`](#drecursive)
    - [_Decoder_`.andThen` \& chaining](#decoderandthen--chaining)
  - [🍲 Recipes](#-recipes)
  - [♻️ Similar projects and differences](#️-similar-projects-and-differences)

### Methods

Decoders can consume data through one of these methods:

#### _Decoder_`.decode`

This method returns an `Either<DecoderError,D>` type based on whether the decoder would fail or pass.

```ts
D.string.decode('a string') // E.Right<'somestringvalue'>

D.string.decode(42) // E.Left<DecoderError>

// Using it in practice
const decoder = D.array(D.boolean)
const data = [true, false]
const validationResult = decoder.decode(data)
if (either.isLeft) {
    // TypeScript now knows that result has error so you can log the error message
    console.error(validationResult.left.message)
    return
}
// TypeScript now knows that result has data which is an array of booleans
validationResult.right.map(console.log)
```

#### _Decoder_`.is`

This method returns true or false based on whether the decoder would fail. It also serves as a type guard.

```ts
D.string.is('string') // true

D.string.is(42) // false

// Type guard out of this
const decoder = D.array(D.boolean)
const data = [true, false]

if (decoder.is(data)) {
  // TypeScript now knows that data is an array of booleans
  data.map(console.log)
} else {
  console.log('This is not and array of booleans')
}
```

### Primitives

All primitive decoders work the same

#### `D.string`

This is a simple decoder: if the input is a string, return the string, else fail (e.g. return `null` or throw an error).

```ts
D.string.decode('a string') // E.Right<'a string'>

D.string.decode(42) // E.Left<DecoderError>
D.string.decode({}) // E.Left<DecoderError>
```

#### `D.number`

```ts
D.number.decode(42) // E.Right<42>

D.number.decode('a string') // E.Left<DecoderError>
```

#### `D.boolean`

```ts
D.boolean.decode(true) // E.Right<true>

D.boolean.decode('not a boolean') // E.Left<DecoderError>
```

#### `D.literal`

Literal decoder only decodes the exact same value (compared using `===`).

```ts
D.literal('data').decode('data') // E.Right<'data'>
D.literal('error').decode('error') // E.Right<'error'>
D.literal(0).decode(0) // E.Right<0>

D.literal('data').decode('error') // E.Left<DecoderError>
D.literal(0).decode(1) // E.Left<DecoderError>
```

#### `D.literalUnion`

`D.literalUnion` combines `D.literal` and `D.oneOf` the way you would expect.

```ts
const decoder = D.literalUnion('data', 'error') // D.Decoder<'data' | 'error'>

decoder.decode('data') // E.Right<'data'>
decoder.decode('error') // E.Right<'error'>

decoder.decode('not in there') // E.Left<DecoderError>
```

#### `D.regex`

`D.regex` checks if a given regular expression matches the data. (This is particularly useful when you want to transform the data afterwards. See [`andThen`](#decoderandthen--chaining))

```ts
const decoder = D.regex(/^\d+$/)

decoder.decode('138') // E.Right<'138'>

decoder.decode('Not nice') // E.Left<DecoderError>
```

With transformation afterwards:

```ts
decoder.decode('138').andThen(Number) // E.Right<138>
```

#### `D.nullable`

If you wrap a decoder in `D.nullable`, then it wither decodes to its supposed type or falls back to `O.none`.

```ts
const decoder = D.nullable(D.string)

decoder.decode('hello') // E.Right<O.some('hello')>
decoder.decode(null) // E.Right<O.none>

decoder.decode(15) // E.Left<DecoderError>
```

#### `D.succeed`

This decoder always succesfully decodes to the value provided.

```ts
D.succeed(true).decode('unnecessary string') // E.Right<true>
D.succeed(1234).decode({}) // E.Right<1234>
```

### Combinators

#### `D.oneOf`

This decoder tries all the decoders passed to it in order and returns the first one that succeeds.

```ts
const decoder = D.oneOf(D.string, D.number)

decoder.decode('a string') // E.Right<'a string'>
decoder.decode(42) // E.Right<42>

decoder.decode(false) // E.Left<DecoderError>
```

#### `D.allOf`

This decoder tries all the decoders passed to it in order and returns the first one that succeeds.

```ts
const decoder = D.allOf(
  D.object({
    a: D.string,
  }),
  D.object({
    b: D.number,
    c: D.boolean
  })
)

decoder.decode({ a: 'a string', b: 132, c: true }) // E.Right<{ a: 'a string', b: 132, c: true }>

decoder.decode({ a: 'a string' }) // E.Left<DecoderError>
decoder.decode(false) // E.Left<DecoderError>
```

#### `D.tuple`

Using this you can comfortably decode TS tuples. (for example from JSON arrays)

```ts
const minMaxDecoder = D.tuple(D.number, D.number)

const data = JSON.parse('{ "minmax": [18, 99] }')
D.object({ // More on this below
  required: {
    minmax: minMaxDecoder
  }
}) // { minmax: [18, 99] }
```

`minmax` is now typed as `[number, number]` and not as `number[]`

```ts
D.tuple(D.string, D.string).decode(['Michael', 'Jackson']) // E.Right<['Michael', 'Jackson']>
```

Longer arrays get stripped at the end to fit the length of the tuple. Shorter arrays with not enough elements fail to decode.

#### `D.array`

The array decoder takes another decoder with which it tries to decode a whole JSON array.

```ts
D.array(D.number).decode([1, 2, 3]) // E.Right<[1, 2, 3]>

D.array(D.number).decode([1, 2, 'not a number']) // E.Left<DecoderError>
```

#### `D.record`

This decoder works the same as [`D.array`](#darray) except that it parses an object and returns `Record<string, D>`.

```ts
const decoder = D.record(D.number)

const data = {
  preschoolers: 55,
  student: 124,
  employed: 133,
  unemployed: 128,
  retired: 67
}
decoder.decode(data) // succeeds with data as 'Record<string, number>'

const wrongData = {
  preschoolers: null,
  student: '124',
  employed: 133,
  unemployed: 128,
  retired: 67
}
decoder.decode(wrongData) // fails because not all of the values are numbers
```

#### `D.keyValuePairs`

The key-value pairs decoder works the same way as [`D.record`](#drecord) but returns an array of tuples.

```ts
// e.g. with data from previous example
D.keyValuePairs(D.number).forceDecode(data) // succeeds with data as '[[string, number]]'
```

#### `D.object`

This is probably the most important (and the most complicated?) decoder. You can decode whole typed objects like this:

```ts
const person = {
  name: 'Sarah',
  age: 25
}

const personDecoder = D.object({
  name: D.string,
  age: D.number,
  preferredName: D.optional(D.string)
})

personDecoder.forceDecode(person) // succeeds
```

> Careful, `null` is not a missing value! Null is an actual value which is supposed to be handled with `D.nullable(…)`

Again, if you want the type of `personDecoder`, you can use `D.Output<…>`

```ts
type Person = D.Output<typeof personDecoder>

// The above is now equivalent to this interface
interface Person {
  name: string
  age: number
  preferredName: Option<string>
}
```

#### `D.structuredObject`

This decoder is very similar to `D.object` but allows you to split your fields into `required` and `optional` sections:

```ts
const person = {
  name: 'Sarah',
  age: 25
}

const personDecoder = D.structuredObject({
  required: {
    name: D.string,
    age: D.number
  },
  optional: {
    preferredName: D.string
  }
})

personDecoder.forceDecode(person) // succeeds
```

You pass it an object which has `required` and `optional` object with specified fields. Both `required` and `optional` are optional so if you don't have any optional field you can just omit the `optional` field and vice versa.

> Careful, `null` is not a missing value! Null is an actual value which is supposed to be handled with `D.nullable(…)`

Again, if you want the type of `personDecoder`, you can use `D.Output<…>`

```ts
type Person = D.Output<typeof personDecoder>

// The above is now equivalent to this interface
interface Person {
  name: string
  age: number
  preferredName?: string
}
```

#### `D.recursive`

This one allows you to decode recursive types. However, due to the limitations of TypeScript's type system, we can't have type inference and have to write interfaces to decode to manually.

```ts
// We have to define the type manually beforehand
// Let's say that we have a user and they have a first name, last name, and a couple of friends
type User = [string, string, User[]]

// Then, we can create the decoder
const userDecoder = D.tuple(D.string, D.string, D.array(D.recursive(() => userDecoder)))
// This is equivalent
const userDecoder = D.tuple(D.string, D.string, D.recursive(() => D.array(userDecoder)))
// This too is equivalent
const userDecoder = D.recursive(() => D.tuple(D.string, D.string, D.array(userDecoder)))

// And the use it the way you're used to
const bradPitt: User = [
  'Brad',
  'Pitt',
  [
    [
      'Johnny',
      'Depp',
      [
        ['Al', 'Pacino', []]
      ]
    ],
    ['Leonardo', 'DiCaprio', []]
  ]
]

userDecoder.forceDecode(bradPitt) // succeeds with the recursive type User
```

```ts
// Again, you have to define the interface first
interface Category {
  name: string,
  subcategories: Category[]
}

// And then use `recursive` in the decoder
const categoryDecoder: D.Decoder<Category> = D.object({
  required: {
    name: D.string,
    subcategories: D.array(D.recursive(() => categoryDecoder))
  }
})

// This works as well
const categoryDecoder: D.Decoder<Category> = D.recursive(() =>
  D.object({
    required: {
      name: D.string,
      subcategories: D.array(categoryDecoder)
    }
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

categoryDecoder.forceDecode(categories) // succeeds
```

### _Decoder_`.andThen` & chaining

If the built-in types in JSON aren't enough for you, you can extend the provided decoders. Let's say you want to decode a `Date` from an ISO string.

```ts
const dateDecoder = D.string.andThen(date => new Date(date))
// You can now use it with
// dateDecoder.decode(…)

// Amazingly, TS is smart enough to allow for this:
type DecodedDate = D.Output<typeof dateDecoder> // is actually Date! and not a string
```

> Also, if you throw an error from inside the function, the decoder fails as it would fail with a bad type or anything else!

You can use this for:
- Transforming to different types
- Renaming fields in objects
- Performing stricter checks (e.g. string length) and failing the decoder by throwing an error

> Now you can decode anything you please—you're unstoppable!

## 🍲 Recipes

**We recommend checking out some of our [examples](recipes/).**

## ♻️ Similar projects and differences

- [`io-ts`](https://github.com/gcanti/io-ts) – Schemawax is much much smaller
- [`ts-auto-guard`](https://github.com/rhys-vdw/ts-auto-guard) – Takes the opposite approach and creates decoders from interfaces but requires an extra compilation step and tooling. Hard to use in non-TS projects
- [`typescript-is`](https://github.com/woutervh-/typescript-is) – Similar to `ts-auto-guard` but is a transformer for an unofficial version of the TypeScript compiler. Impossible to use without TS
- [`yup`](https://github.com/jquense/yup) – Very similar to Schemawax but has some predefined regexes and is **15× larger**! Anything `yup` can do should be possible with Schemawax
- [`zod`](https://github.com/colinhacks/zod) – Again, very similar to Schemawax but better than yup. It is ~10 kB and it is more complex than Schemawax but offers more pre-built functions (but nothing that can't be done with Schemawax).
- [`ok-computer`](https://github.com/richardscarrott/ok-computer) – Very simple, only made out of pure functions (which is nice) but there is no type safety or inference
