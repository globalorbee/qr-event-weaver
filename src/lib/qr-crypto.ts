// Isomorphic Ed25519 signing/verification helpers.
// @noble/ed25519 works in both the browser and the Worker runtime.
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";

// Required by @noble/ed25519 v3 in non-Node environments
ed.hashes.sha512 = ((msg: Uint8Array) => sha512(msg)) as typeof ed.hashes.sha512;

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64(b64: string): Uint8Array {
  const s = b64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export type PassPayload = {
  a: string; // attendee id
  e: string; // event id
  t: string; // ticket type
  c: string; // pass code
};

export type SignedPass = PassPayload & { s: string }; // base64url signature

export async function generateKeypair(): Promise<{ publicKey: string; privateKey: string }> {
  const priv = ed.utils.randomSecretKey();
  const pub = await ed.getPublicKeyAsync(priv);
  return { privateKey: toB64(priv), publicKey: toB64(pub) };
}

export async function signPayload(payload: PassPayload, privateKeyB64: string): Promise<string> {
  const msg = enc.encode(JSON.stringify(payload));
  const sig = await ed.signAsync(msg, fromB64(privateKeyB64));
  return toB64(sig);
}

export async function verifySignedPass(signed: SignedPass, publicKeyB64: string): Promise<boolean> {
  try {
    const { s, ...payload } = signed;
    const msg = enc.encode(JSON.stringify(payload));
    return await ed.verifyAsync(fromB64(s), msg, fromB64(publicKeyB64));
  } catch {
    return false;
  }
}

export function encodeSignedPass(p: SignedPass): string {
  return toB64(enc.encode(JSON.stringify(p)));
}
export function decodeSignedPass(s: string): SignedPass | null {
  try {
    return JSON.parse(dec.decode(fromB64(s))) as SignedPass;
  } catch {
    try {
      return JSON.parse(s) as SignedPass;
    } catch {
      return null;
    }
  }
}