export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || "30a37963-4067-4ac4-a8c4-fe7edcd2c289",
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || "6fb3d735-1c10-4007-b977-7dbea3388386"}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: [
    import.meta.env.VITE_AZURE_API_SCOPE || "api://ff0f75e1-6d35-40f4-89ae-44a2cfacd4b1/Pedidos.Read",
    "openid",
    "profile"
  ]
};
