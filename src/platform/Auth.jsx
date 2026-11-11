import { useState } from "react";
import { api } from "./api.js";

function Field({ label, hint, ...props }) {
  return (
    <div className="pm-field">
      <label>{label}</label>
      <input {...props} />
      {hint && <span className="pm-hint">{hint}</span>}
    </div>
  );
}

export function AuthScreen({ route, onSignedIn }) {
  const mode = route.path === "/register" ? "register" : route.path === "/forgot" ? "forgot" : route.path === "/reset" ? "reset" : "login";
  const [form, setForm] = useState({ email: "", password: "", name: "", companyName: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      if (mode === "login") { await api("POST", "login", form); onSignedIn(); }
      else if (mode === "register") {
        const result = await api("POST", "register", form);
        if (result.user) onSignedIn();
        else setNotice(result.message);
      } else if (mode === "forgot") {
        setNotice((await api("POST", "request-reset", { email: form.email })).message);
      } else {
        await api("POST", "reset-password", { token: route.params.get("token"), password: form.password });
        setNotice("Password updated. You can sign in now.");
        window.location.hash = "/login";
      }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const title = { login: "Sign in", register: "Create your business account", forgot: "Reset your password", reset: "Choose a new password" }[mode];
  return (
    <div className="pm-auth">
      <form className="pm-card" onSubmit={submit} noValidate>
        <div className="pm-brand" style={{ color: "var(--accent)", paddingLeft: 0 }}>Pressmark Studio</div>
        <h1 style={{ marginBottom: 18 }}>{title}</h1>
        {error && <div className="pm-alert error" role="alert">{error}</div>}
        {notice && <div className="pm-alert ok" role="status">{notice}</div>}
        {mode === "register" && <>
          <Field label="Company name" value={form.companyName} onChange={set("companyName")} autoComplete="organization" required />
          <Field label="Your name" value={form.name} onChange={set("name")} autoComplete="name" />
        </>}
        {mode !== "reset" && <Field label="Work email" type="email" value={form.email} onChange={set("email")} autoComplete="email" required />}
        {mode !== "forgot" && <Field label={mode === "reset" ? "New password" : "Password"} type="password" value={form.password} onChange={set("password")}
          autoComplete={mode === "login" ? "current-password" : "new-password"} hint={mode === "login" ? undefined : "At least 10 characters."} required />}
        <button className="pm-btn primary big" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
          {busy ? "Please wait…" : { login: "Sign in", register: "Create account", forgot: "Send reset link", reset: "Update password" }[mode]}
        </button>
        <p className="pm-hint" style={{ marginTop: 16 }}>
          {mode === "login" && <><a href="#/register">Create an account</a> · <a href="#/forgot">Forgot password?</a></>}
          {mode !== "login" && <a href="#/login">Back to sign in</a>}
        </p>
      </form>
    </div>
  );
}
