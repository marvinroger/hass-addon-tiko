import { ok, err, Result } from "neverthrow";
import { ZodType, z } from "zod";
import { type ValidationError, fromZodError } from "zod-validation-error";

export function validate<Schema extends ZodType>(
  schema: Schema,
  value: unknown
): Result<z.infer<Schema>, ValidationError> {
  const result = schema.safeParse(value);

  if (result.success) {
    return ok(result.data);
  }

  return err(fromZodError(result.error));
}
