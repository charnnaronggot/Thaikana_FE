export interface LoginChallenge { challengeId: string; publicKey: string; expiresAt: string; }
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

export async function encryptLogin(challenge: LoginChallenge, username: string, password: string) {
  if (!globalThis.crypto?.subtle) throw new Error('Login requires HTTPS or localhost.');
  const crypto = globalThis.crypto.subtle;
  const publicKey = await crypto.importKey('spki', Uint8Array.from(atob(challenge.publicKey), c => c.charCodeAt(0)), {name:'RSA-OAEP', hash:'SHA-256'}, false, ['encrypt']);
  const key = await crypto.generateKey({name:'AES-GCM', length:256}, true, ['encrypt']);
  const rawKey = new Uint8Array(await crypto.exportKey('raw', key));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify({username, password}));
  try {
    const ciphertext = await crypto.encrypt({name:'AES-GCM', iv, additionalData:new TextEncoder().encode(challenge.challengeId), tagLength:128}, key, plaintext);
    const encryptedKey = await crypto.encrypt({name:'RSA-OAEP'}, publicKey, rawKey);
    return {challengeId:challenge.challengeId, encryptedKey:base64(new Uint8Array(encryptedKey)), iv:base64(iv), ciphertext:base64(new Uint8Array(ciphertext))};
  } finally { rawKey.fill(0); plaintext.fill(0); }
}
