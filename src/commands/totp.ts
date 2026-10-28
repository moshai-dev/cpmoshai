import { hostname } from "node:os";
import { TotpGuard } from "../approval/guard";
import { generateSecret, otpauthUri, verifyTotp } from "../approval/totp";
import { loadRemoteConfig } from "../remote/config";
import { promptSecret } from "../prompt";

export async function totpInit(): Promise<void> {
  const guard = new TotpGuard(loadRemoteConfig({ ...process.env, CPMOSHAI_ALLOWED_HOSTS: "-" }).totpFile);
  const secret = generateSecret();
  console.log("Add this account to your authenticator app (TOTP, 6 digits, 30 seconds):\n");
  console.log(`  key: ${secret}`);
  console.log(`  uri: ${otpauthUri(secret, hostname(), "cpmoshai")}\n`);

  const step = verifyTotp(secret, await promptSecret("Current code to confirm enrolment: "), Date.now(), -1);
  if (step === null) throw new Error("Code did not match; nothing was saved");
  guard.enroll(secret, step);
  console.log("2FA enrolled.");
}
