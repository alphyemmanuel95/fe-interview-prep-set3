// Compile-time exhaustiveness check for discriminated unions: adding a new variant
// without handling it turns the `default` branch into a type error.
export function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}
