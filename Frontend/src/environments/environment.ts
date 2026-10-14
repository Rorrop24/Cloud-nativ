export const environment = {
  production: false,
  azure: {
    clientId: '30a37963-4067-4ac4-a8c4-fe7edcd2c289',
    tenantId: '6fb3d735-1c10-4007-b977-7dbea3388386',
    authority: 'https://login.microsoftonline.com/6fb3d735-1c10-4007-b977-7dbea3388386',
    redirectUri: 'http://localhost:5173',
    protectedResourceScopes: ['api://ff0f75e1-6d35-40f4-89ae-44a2cfacd4b1/Pedidos.Read']
  },
  apiBaseUrl: 'https://h1m5l703rk.execute-api.us-east-1.amazonaws.com/Desarrollo'
};