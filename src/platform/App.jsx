import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import { CSS } from "./styles.js";
import { AuthScreen } from "./Auth.jsx";
import { Overview, NewJob, Projects, ProjectDetail, Templates, Settings } from "./pages.jsx";

/* Hash routing: the site is a static multi-page build, so /app is one HTML file
   and everything after the # needs no server rewrite rules. */
function useRoute() {
  const read = () => {
    const [path, query = ""] = (window.location.hash.replace(/^#/, "") || "/").split("?");
    return { path, params: new URLSearchParams(query) };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

const NAV = [
  { to: "/", label: "Overview" },
  { to: "/new", label: "New Production Job" },
  { to: "/projects", label: "My Projects" },
  { to: "/templates", label: "Templates" },
  { to: "/settings", label: "Account Settings" },
];
const SOON = ["Proofs & Approvals", "Billing & Subscription"];

export default function App() {
  const route = useRoute();
  const [session, setSession] = useState({ state: "loading" });

  const refresh = useCallback(async () => {
    try {
      setSession({ state: "in", ...(await api("GET", "me")) });
    } catch (error) {
      setSession(error.status === 401 ? { state: "out" } : { state: "error", message: error.message });
    }
  }, []);
  useEffect(() => {
    api("GET", "me").then(
      (me) => setSession({ state: "in", ...me }),
      (error) => setSession(error.status === 401 ? { state: "out" } : { state: "error", message: error.message })
    );
  }, []);

  const logout = async () => {
    await api("POST", "logout").catch(() => {});
    window.location.hash = "/login";
    setSession({ state: "out" });
  };

  let body;
  if (session.state === "loading") body = <div className="pm-auth"><p className="pm-sub">Loading…</p></div>;
  else if (session.state === "error") body = (
    <div className="pm-auth"><div className="pm-card">
      <h1>Dashboard unavailable</h1><div className="pm-alert error">{session.message}</div>
      <button className="pm-btn" onClick={refresh}>Try again</button>
    </div></div>
  );
  else if (session.state === "out") body = <AuthScreen route={route} onSignedIn={() => { window.location.hash = "/"; refresh(); }} />;
  else {
    const { path, params } = route;
    const projectMatch = path.match(/^\/projects\/([a-f0-9]{32})$/);
    let page;
    if (path === "/new") page = <NewJob org={session.org} />;
    else if (path === "/projects") page = <Projects />;
    else if (projectMatch) page = <ProjectDetail id={projectMatch[1]} user={session.user} />;
    else if (path === "/templates") page = <Templates />;
    else if (path === "/settings") page = <Settings session={session} onChanged={refresh} />;
    else if (path === "/verify") page = <Overview user={session.user} verifyToken={params.get("token")} onVerified={refresh} />;
    else page = <Overview user={session.user} onVerified={refresh} />;
    const active = projectMatch ? "/projects" : path === "/verify" ? "/" : path;
    body = (
      <div className="pm-shell">
        <aside className="pm-side">
          <div className="pm-brand">Pressmark Studio</div>
          <nav className="pm-nav" aria-label="Dashboard">
            {NAV.map((item) => (
              <a key={item.to} href={`#${item.to}`} aria-current={active === item.to ? "page" : undefined}>{item.label}</a>
            ))}
            {SOON.map((label) => <span key={label} title="Not available yet">{label}<small>Soon</small></span>)}
            <a href="/contact">Support</a>
          </nav>
          <div className="pm-side-foot">
            <div>{session.org?.name}</div>
            <div style={{ marginBottom: 6 }}>{session.user.email}</div>
            <button onClick={logout}>Sign out</button>
          </div>
        </aside>
        <main className="pm-main">{page}</main>
      </div>
    );
  }
  return <><style>{CSS}</style>{body}</>;
}
