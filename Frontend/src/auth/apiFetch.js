import { msalInstance } from "./msalClient";
import { loginRequest } from "../authConfig";

const apiRoots = [
  import.meta.env.VITE_API_URL || window.location.origin,
  import.meta.env.VITE_GATEWAY_URL || import.meta.env.VITE_API_URL || window.location.origin,
  import.meta.env.VITE_RABBIT_ADMIN_URL || window.location.origin,
].map(value => new URL(value, window.location.origin));

function isApi(url) {
  const target = new URL(url, window.location.origin);
  return apiRoots.some(root => target.origin === root.origin &&
    target.pathname.startsWith(root.pathname.replace(/\/$/, "") + "/") &&
    /\/(v2|api|bff)\//.test(target.pathname));
}

export async function apiFetch(url, options = {}) {
  if (!isApi(url)) return window.fetch(url, options);
  const headers = new Headers(options.headers);
  headers.delete("Authorization");
  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
  if (account) {
    // MSAL renews expired access tokens; a localStorage token is never an authority source.
    const result = await msalInstance.acquireTokenSilent({ ...loginRequest, account });
    headers.set("Authorization", `Bearer ${result.accessToken}`);
  }
  return window.fetch(url, { ...options, headers });
}

export async function getApiClaims() {
  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
  if (!account) return { roles: [], scopes: [] };
  const result = await msalInstance.acquireTokenSilent({ ...loginRequest, account });
  const encoded = result.accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")), c => c.charCodeAt(0));
  const claims = JSON.parse(new TextDecoder().decode(bytes));
  if (!claims.exp || claims.exp <= Date.now() / 1000) return { roles: [], scopes: [] };
  // These claims only control presentation; the API enforces all permissions.
  return {
    roles: Array.isArray(claims.roles) ? claims.roles.filter(role => typeof role === "string") : [],
    scopes: typeof claims.scp === "string" ? claims.scp.split(/\s+/).filter(Boolean) : [],
  };
}
