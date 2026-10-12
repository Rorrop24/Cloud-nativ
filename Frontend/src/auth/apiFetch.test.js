import { beforeEach, expect, test, vi } from "vitest";

vi.mock("./msalClient", () => ({
  msalInstance: { getActiveAccount: vi.fn(), getAllAccounts: vi.fn(), acquireTokenSilent: vi.fn() },
}));
import { msalInstance } from "./msalClient";
import { apiFetch, getApiClaims } from "./apiFetch";

beforeEach(() => {
  vi.resetAllMocks();
  msalInstance.getAllAccounts.mockReturnValue([]);
  vi.spyOn(window, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
});

test("obtains a fresh API access token and replaces stale headers", async () => {
  msalInstance.getActiveAccount.mockReturnValue({ homeAccountId: "azure-account" });
  msalInstance.acquireTokenSilent.mockResolvedValue({ accessToken: "fresh-token" });
  await apiFetch("/v2/usuarios/todos", { headers: { Authorization: "Bearer stale-token" } });
  expect(msalInstance.acquireTokenSilent).toHaveBeenCalled();
  expect(window.fetch.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer fresh-token");
});

test("does not trust localStorage tokens without an MSAL account", async () => {
  localStorage.setItem("token", "fake-admin");
  await apiFetch("/v2/productos/todos", { headers: { Authorization: "Bearer fake-admin" } });
  expect(window.fetch.mock.calls[0][1].headers.has("Authorization")).toBe(false);
  expect(msalInstance.acquireTokenSilent).not.toHaveBeenCalled();
});

test("never attaches the token to another origin", async () => {
  msalInstance.getActiveAccount.mockReturnValue({ homeAccountId: "azure-account" });
  await apiFetch("https://other.example.test/api/catalog");
  expect(msalInstance.acquireTokenSilent).not.toHaveBeenCalled();
});

test("uses roles and scopes from the API access token", async () => {
  msalInstance.getActiveAccount.mockReturnValue({ homeAccountId: "azure-account" });
  const payload = btoa(JSON.stringify({ roles: ["Rabbit.Admin", 1], scp: "Pedidos.Read", exp: Date.now() / 1000 + 60 }));
  msalInstance.acquireTokenSilent.mockResolvedValue({ accessToken: "e30." + payload + ".sig" });
  expect(await getApiClaims()).toEqual({ roles: ["Rabbit.Admin"], scopes: ["Pedidos.Read"] });
});

test("expired claims never grant administration in the UI", async () => {
  msalInstance.getActiveAccount.mockReturnValue({ homeAccountId: "azure-account" });
  const payload = btoa(JSON.stringify({ roles: ["Rabbit.Admin"], exp: 1 }));
  msalInstance.acquireTokenSilent.mockResolvedValue({ accessToken: "e30." + payload + ".sig" });
  expect((await getApiClaims()).roles).toEqual([]);
});
