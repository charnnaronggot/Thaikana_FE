import { expect, it } from 'vitest';
import { encryptLogin } from '../src/app/core/auth/login-encryption';

it('encrypts credentials with RSA-OAEP/AES-GCM bound to the challenge', async () => {
  const subtle = globalThis.crypto.subtle;
  const pair = await subtle.generateKey({name:'RSA-OAEP', modulusLength:3072, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256'}, true, ['encrypt','decrypt']);
  const publicKey = btoa(String.fromCharCode(...new Uint8Array(await subtle.exportKey('spki', pair.publicKey))));
  const challenge = {challengeId:'test-challenge', publicKey, expiresAt:new Date(Date.now()+120000).toISOString()};
  const encrypted = await encryptLogin(challenge, 'dev-sales', 'ทดสอบ!password');
  expect(JSON.stringify(encrypted)).not.toContain('dev-sales');
  expect(JSON.stringify(encrypted)).not.toContain('ทดสอบ!password');
  const decode = (s:string) => Uint8Array.from(atob(s), c=>c.charCodeAt(0));
  const raw = await subtle.decrypt({name:'RSA-OAEP'}, pair.privateKey, decode(encrypted.encryptedKey));
  const key = await subtle.importKey('raw', raw, {name:'AES-GCM'}, false, ['decrypt']);
  const plaintext = await subtle.decrypt({name:'AES-GCM', iv:decode(encrypted.iv), additionalData:new TextEncoder().encode(challenge.challengeId)}, key, decode(encrypted.ciphertext));
  expect(JSON.parse(new TextDecoder().decode(plaintext))).toEqual({username:'dev-sales',password:'ทดสอบ!password'});
  await expect(subtle.decrypt({name:'AES-GCM',iv:decode(encrypted.iv),additionalData:new TextEncoder().encode('another-challenge')},key,decode(encrypted.ciphertext))).rejects.toThrow();
});
