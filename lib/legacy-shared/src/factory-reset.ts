export const FACTORY_RESET_CONFIRMATION_MAX_LENGTH = 100;

export function isValidFactoryResetConfirmation(
  confirmation: unknown,
  familyName: string,
): boolean {
  return (
    typeof confirmation === "string" &&
    confirmation.length <= FACTORY_RESET_CONFIRMATION_MAX_LENGTH &&
    confirmation.trim() === familyName
  );
}