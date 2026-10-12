export interface AccessClaims {
  sub?: string;
  oid?: string;
  tid?: string;
  exp?: number;
  name?: string;
  preferred_username?: string;
  roles: string[];
  scopes: string[];
}

// Decoding is for UI authorization only. Both Java services validate the signature.
export function readAccessClaims(token: string): AccessClaims {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='));
  const decoded: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0))));
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) throw new Error('Invalid JWT claims');
  const value = decoded as Record<string, unknown>;
  const strings = (v: unknown): string[] => Array.isArray(v) ? v.filter((item): item is string => typeof item === 'string') : [];
  return {
    sub: typeof value['sub'] === 'string' ? value['sub'] : undefined,
    oid: typeof value['oid'] === 'string' ? value['oid'] : undefined,
    tid: typeof value['tid'] === 'string' ? value['tid'] : undefined,
    name: typeof value['name'] === 'string' ? value['name'] : undefined,
    preferred_username: typeof value['preferred_username'] === 'string' ? value['preferred_username'] : undefined,
    exp: typeof value['exp'] === 'number' ? value['exp'] : undefined,
    roles: strings(value['roles']),
    scopes: typeof value['scp'] === 'string' ? value['scp'].split(/\s+/).filter(Boolean) : [],
  };
}

export function hasAccess(claims: AccessClaims, roles: string[], scopes: string[]): boolean {
  return typeof claims.exp === 'number' && claims.exp > Date.now() / 1000 &&
    roles.every(role => claims.roles.includes(role)) &&
    scopes.every(scope => claims.scopes.includes(scope));
}
