import 'bootstrap/dist/css/bootstrap.min.css';
import "bootstrap-icons/font/bootstrap-icons.css";
import './index.css';
import './App.css';
import App from './App.jsx';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./auth/msalClient";
import { sincronizarUsuarioAzure } from "./utils/apihelper";

async function bootstrap() {
  await msalInstance.initialize();
  try {
    const response = await msalInstance.handleRedirectPromise();
    const account = response?.account || msalInstance.getAllAccounts()[0];
    msalInstance.setActiveAccount(account || null);
    ["token", "usuario", "usuarioId"].forEach(key => localStorage.removeItem(key));
    if (account) {
      try {
        await sincronizarUsuarioAzure();
      } catch (error) {
        // Identity login remains available if the database is offline; purchases require a synced profile.
        console.warn("No se pudo sincronizar el perfil de Punto Gamer:", error.message);
        localStorage.setItem("usuario", JSON.stringify({ nombre: account.name, email: account.username, rol: "USER" }));
      }
    }
  } catch (error) {
    console.error("No se pudo iniciar la sesion de Azure:", error.message);
  }
  createRoot(document.getElementById('root')).render(
    <StrictMode><MsalProvider instance={msalInstance}>
      <BrowserRouter><App /></BrowserRouter>
    </MsalProvider></StrictMode>
  );
}

bootstrap().catch(() => {
  document.getElementById("root").textContent = "No se pudo iniciar Punto Gamer. Recarga la pagina.";
});
