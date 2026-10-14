// Match the regular family member switch: an unset parent PIN defaults to 0000.
// Configured PINs must always be checked against their stored hash.
export async function verifyTvParentPin(
  configuredPin: string | null | undefined,
  enteredPin: string,
  validateConfiguredPin: () => Promise<boolean>,
): Promise<boolean> {
  return configuredPin ? validateConfiguredPin() : enteredPin === "0000";
}