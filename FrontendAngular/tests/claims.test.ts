import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { hasAccess, readAccessClaims } from '../src/app/auth/claims.js';

function token(claims: unknown): string { return 'e30.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.signature'; }
test('extracts API roles, scopes and UTF-8 claims', () => {
  const claims = readAccessClaims(token({ roles: ['Rabbit.Admin', 4], scp: 'Pedidos.Read  Pedidos.Write', name: 'José', exp: Date.now() / 1000 + 60 }));
  assert.deepEqual(claims.roles, ['Rabbit.Admin']);
  assert.deepEqual(claims.scopes, ['Pedidos.Read', 'Pedidos.Write']);
  assert.equal(claims.name, 'José');
  assert.equal(hasAccess(claims, ['Rabbit.Admin'], ['Pedidos.Read']), true);
});
test('denies missing roles and missing scopes', () => {
  const claims = readAccessClaims(token({ roles: [], scp: 'Pedidos.Read', exp: Date.now() / 1000 + 60 }));
  assert.equal(hasAccess(claims, ['Rabbit.Admin'], []), false);
  assert.equal(hasAccess(claims, [], ['Pedidos.Write']), false);
});
test('denies expired and missing expiration', () => {
  assert.equal(hasAccess(readAccessClaims(token({ exp: 1 })), [], []), false);
  assert.equal(hasAccess(readAccessClaims(token({})), [], []), false);
});
test('rejects malformed and non-object payloads', () => {
  for (const value of ['bad', 'a.!.b', token(null), token([])]) assert.throws(() => readAccessClaims(value));
});
