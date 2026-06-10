import "server-only";
import { randomBytes, randomInt } from "crypto";

// No 0/O/1/I to keep codes easy to read out loud at the table
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateJoinCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export function generateSecretKey(): string {
  return randomBytes(24).toString("base64url");
}
