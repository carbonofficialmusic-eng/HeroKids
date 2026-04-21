import { checkTransactionalEmailHealth } from "../server/emailHealth";

function getArgValue(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

const testRecipient = getArgValue("--send-to") || process.env.EMAIL_HEALTH_TEST_RECIPIENT;
const expectedProductionBaseUrl = getArgValue("--expected-production-url") || process.env.EMAIL_HEALTH_EXPECTED_PRODUCTION_URL;

const result = await checkTransactionalEmailHealth({
  testRecipient,
  expectedProductionBaseUrl,
});

console.log(JSON.stringify(result, null, 2));

if (result.status !== "healthy") {
  process.exitCode = 1;
}