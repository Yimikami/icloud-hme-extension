import { toBase64, fromBase64 } from "./utils.js";

const ENCRYPTION_ALGO = "AES-GCM";
const KEY_ITERATIONS = 100000;
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // Standard for AES-GCM
const SALT_LENGTH = 16;

async function deriveKey(passphrase, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: KEY_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ENCRYPTION_ALGO, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptSession(session, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  const key = await deriveKey(passphrase, salt);
  
  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(session));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: ENCRYPTION_ALGO, iv: iv },
    key,
    plaintext
  );

  return JSON.stringify({
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(encrypted)),
  });
}

export async function decryptSession(fileContent, passphrase) {
  try {
    const { salt: saltB64, iv: ivB64, data: dataB64 } = JSON.parse(fileContent);
    const salt = fromBase64(saltB64);
    const iv = fromBase64(ivB64);
    const data = fromBase64(dataB64);

    const key = await deriveKey(passphrase, salt);

    const decrypted = await crypto.subtle.decrypt(
      { name: ENCRYPTION_ALGO, iv: iv },
      key,
      data
    );

    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  } catch (err) {
    throw new Error("Invalid passphrase or corrupted session data.");
  }
}
