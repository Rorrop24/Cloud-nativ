export const environment = {
  production: false,
  azure: {
    clientId: '9870c4b1-0353-4eb0-8e1d-812cb76676b5', 
    tenantId: 'a5af7e18-9965-418a-9b8a-a0dd9bd96c52', 
    authority: 'https://login.microsoftonline.com/a5af7e18-9965-418a-9b8a-a0dd9bd96c52', 
    redirectUri: 'http://localhost:5173', 
    protectedResourceScopes: ['api://ae706c64-5e56-4573-b311-b2919b52c67a/Pedidos.Read'] 
  },
  apiBaseUrl: 'https://h1m5l703rk.execute-api.us-east-1.amazonaws.com/Desarrollo'
};