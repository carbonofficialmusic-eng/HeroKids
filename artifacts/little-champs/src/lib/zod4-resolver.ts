import { toNestErrors, validateFieldsNatively } from "@hookform/resolvers";
import {
  appendErrors,
  type FieldError,
  type FieldValues,
  type Resolver,
} from "react-hook-form";
import { z } from "zod/v4";

/**
 * The installed @hookform/resolvers v3 Zod adapter only accepts Zod 3
 * schemas. Keep the app's existing resolver dependency and adapt Zod 4 by
 * using its public parse result and the same RHF error nesting utilities.
 */
export function zod4Resolver<TSchema extends z.ZodType<FieldValues>>(
  schema: TSchema,
): Resolver<z.output<TSchema>, unknown, z.output<TSchema>> {
  return async (values, _context, options) => {
    const result = await schema.safeParseAsync(values);

    if (result.success) {
      if (options.shouldUseNativeValidation) {
        validateFieldsNatively<z.output<TSchema>>({}, options);
      }
      return { values: result.data, errors: {} };
    }

    const flatErrors: Record<string, FieldError> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.map(String).join(".");
      if (!flatErrors[path]) {
        flatErrors[path] = { message: issue.message, type: issue.code };
      }

      if (options.criteriaMode === "all") {
        const previousMessages = flatErrors[path].types?.[issue.code];
        const messages: string | string[] =
          typeof previousMessages === "string"
            ? [previousMessages, issue.message]
            : Array.isArray(previousMessages)
              ? [
                  ...previousMessages.filter(
                    (message): message is string => typeof message === "string",
                  ),
                  issue.message,
                ]
              : issue.message;
        flatErrors[path] = {
          ...flatErrors[path],
          ...appendErrors(path, true, flatErrors, issue.code, messages),
        };
      }
    }

    return {
      values: {},
      errors: toNestErrors<z.output<TSchema>>(flatErrors, options),
    };
  };
}