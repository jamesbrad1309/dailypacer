import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with Node's scrypt: no native dependency. Stored as
 * "scrypt$N$r$p$salt$hash" (base64url), so the cost can rise later and old
 * hashes still verify with the parameters they were made with.
 */

const N = 16_384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
// scrypt needs 128 * N * r bytes; leave headroom over Node's 32 MB default.
const MAX_MEMORY = 64 * 1024 * 1024;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200;

function derive(password: string, salt: Buffer, n: number, r: number, p: number, length: number) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password.normalize("NFKC"),
      salt,
      length,
      { N: n, r, p, maxmem: MAX_MEMORY },
      (err, key) => (err ? reject(err) : resolve(key)),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, N, R, P, KEY_LENGTH);
  return ["scrypt", N, R, P, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

/** False for a wrong password or a hash it can't read; never throws on bad input. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await derive(
    password,
    Buffer.from(salt, "base64url"),
    Number(n),
    Number(r),
    Number(p),
    expected.length,
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * A real hash of a random password, verified against when the email isn't
 * known, so a sign-in takes as long whether or not the account exists.
 */
export const DUMMY_HASH = hashPassword(randomBytes(16).toString("hex"));
