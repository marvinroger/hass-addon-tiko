import { type } from "arktype";
import { ok, err, Result } from "neverthrow";

export function validate<Schema extends type.Any>(
  schema: Schema,
  value: unknown
): Result<Schema["infer"], Error> {
  const result = schema(value);

  if (result instanceof type.errors) {
    return err(new Error(result.summary));
  }

  return ok(result);
}
