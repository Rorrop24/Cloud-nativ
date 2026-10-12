import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { getApiClaims } from "../auth/apiFetch";

export default function Navbar({ cantidad = 0, abrirCarrito, usuario }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState("");
  const accountRef = useRef(null);
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();
  const account = accounts[0];
  const name = usuario?.nombre || account?.name;
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    setIsAdmin(false);
    if (account) getApiClaims().then(claims => {
      if (active) setIsAdmin(claims.roles.includes("Rabbit.Admin"));
    }).catch(() => {});
    return () => { active = false; };
  }, [account]);

  useEffect(() => {
    const close = (event) => {
      if (!accountRef.current?.contains(event.target)) setAccountOpen(false);
      if (event.key === "Escape") { setAccountOpen(false); setMenuOpen(false); }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, []);

  const logout = () => {
    ["usuario", "token", "usuarioId"].forEach((key) => localStorage.removeItem(key));
    window.dispatchEvent(new Event("usuarioCambiado"));
    setAccountOpen(false);
    if (account) instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
    else navigate("/");
  };

  return (
    <header className="store-header">
      <div className="container store-header-main">
        <Link className="store-brand" to="/" aria-label="Punto Gamer, inicio">
          <i className="bi bi-controller brand-symbol" aria-hidden="true" />
          <span>PUNTO <small>GAMER</small></span>
        </Link>
        <form className="header-search" role="search" onSubmit={(event) => {
          event.preventDefault(); navigate(`/categoria?q=${encodeURIComponent(query)}`); setMenuOpen(false);
        }}>
          <i className="bi bi-search" aria-hidden="true" />
          <input aria-label="Buscar productos" placeholder="Buscar en Punto Gamer" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button type="submit" title="Buscar" aria-label="Buscar"><i className="bi bi-arrow-right" /></button>
        </form>
        <div className="header-actions">
          <div className="account-menu" ref={accountRef}>
            <button className="account-button" onClick={() => setAccountOpen(!accountOpen)} aria-expanded={accountOpen}>
              <i className="bi bi-person" /><span>{name || "Mi cuenta"}</span><i className="bi bi-chevron-down small" />
            </button>
            {accountOpen && <div className="account-dropdown">
              {name ? <>
                <Link to="/perfil" onClick={() => setAccountOpen(false)}>Mi perfil</Link>
                {isAdmin && <Link to="/homeadmin" onClick={() => setAccountOpen(false)}>Administracion</Link>}
                <button onClick={logout}>Cerrar sesion</button>
              </> : <Link to="/auth" onClick={() => setAccountOpen(false)}>Iniciar sesion</Link>}
            </div>}
          </div>
          <button className="icon-button cart-button" onClick={abrirCarrito} title="Abrir carrito" aria-label={`Carrito, ${cantidad} productos`}>
            <i className="bi bi-bag" />{cantidad > 0 && <span className="cart-count">{cantidad}</span>}
          </button>
          <button className="icon-button mobile-menu-button" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            <i className={menuOpen ? "bi bi-x-lg" : "bi bi-list"} />
          </button>
        </div>
      </div>
      <nav aria-label="Navegacion principal" className={`store-navigation ${menuOpen ? "is-open" : ""}`}>
        <div className="container navigation-inner">
          {[["/", "Inicio"], ["/categoria", "Catalogo"], ["/ofertas", "Ofertas"], ["/eventos", "Eventos"], ["/blog", "Comunidad"], ["/soporte", "Soporte"]].map(([path, label]) =>
            <NavLink key={path} to={path} end onClick={() => setMenuOpen(false)}>{label}</NavLink>
          )}
          <Link className="navigation-about" to="/nosotros" onClick={() => setMenuOpen(false)}>Sobre Punto Gamer<i className="bi bi-arrow-up-right" /></Link>
        </div>
      </nav>
    </header>
  );
}
