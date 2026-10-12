import { useState } from "react";
import { useMsal } from "@azure/msal-react";
import { Link } from "react-router-dom";
import { loginRequest } from "../authConfig";
import Footer from "../components/Footer";

export default function Auth() {
  const { instance } = useMsal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const login = async () => {
    setBusy(true); setError("");
    try { await instance.loginRedirect(loginRequest); }
    catch { setError("No pudimos iniciar sesion. Vuelve a intentarlo."); setBusy(false); }
  };
  return <><main className="container py-5 d-flex justify-content-center">
    <section className="auth-box">
      <span className="eyebrow">PUNTO GAMER</span><h1 className="h3 mb-3">Inicia sesion</h1>
      <p className="text-secondary mb-4">Accede a tu cuenta y revisa tus compras.</p>
      {error && <div className="admin-alert" role="alert">{error}</div>}
      <button className="btn btn-accent w-100" onClick={login} disabled={busy}><i className="bi bi-microsoft" />{busy ? "Conectando..." : "Continuar con Microsoft"}</button>
      <Link className="text-link mt-4" to="/"><i className="bi bi-arrow-left" />Volver a la tienda</Link>
    </section>
  </main><Footer /></>;
}
