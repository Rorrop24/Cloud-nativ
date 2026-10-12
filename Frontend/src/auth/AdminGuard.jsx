import { useEffect, useState } from "react";
import { Link, Navigate, Outlet } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { getApiClaims } from "./apiFetch";

export default function AdminGuard() {
  const { accounts, inProgress } = useMsal();
  const [access, setAccess] = useState("loading");
  const accountId = accounts[0]?.homeAccountId;
  useEffect(() => {
    let active = true;
    if (inProgress !== InteractionStatus.None || !accountId) return undefined;
    setAccess("loading");
    getApiClaims().then(claims => {
      if (active) setAccess(claims.roles.includes("Rabbit.Admin") ? "allowed" : "denied");
    }).catch(() => { if (active) setAccess("denied"); });
    return () => { active = false; };
  }, [accountId, inProgress]);
  if (inProgress !== InteractionStatus.None) return <p className="container py-5" role="status">Comprobando sesion...</p>;
  if (!accountId) return <Navigate to="/auth" replace />;
  if (access === "loading") return <p className="container py-5" role="status">Comprobando acceso...</p>;
  if (access !== "allowed") return <main className="container py-5"><h1 className="h3">Acceso restringido</h1>
    <p>Tu cuenta no tiene permisos de administracion.</p><Link to="/">Volver a la tienda</Link></main>;
  return <Outlet />;
}
