import type { TFunction } from "i18next";
import { toast } from "sonner";

/**
 * Log an error with a caller context. The Enter Analytics SDK automatically
 * captures runtime errors, so console.error here is the source for that.
 */
export function logError(context: string, error: unknown): void {
  console.error(`[${context}]`, error);
}

/** Log + show a user-facing toast with an i18n fallback key. */
export function handleError(
  t: TFunction,
  context: string,
  error: unknown,
  fallbackKey = "errors.default",
): void {
  logError(context, error);
  toast.error(t(fallbackKey));
}
