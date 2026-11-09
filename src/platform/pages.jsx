import { useCallback, useEffect, useRef, useState } from "react";
import { BRAND_COLORS, DEFAULT_COLORS, normalizeHex } from "../instant-proof/colors.js";
import { api, nextAction, STATUS_LABEL } from "./api.js";
import PdfPreview from "../instant-proof/components/PdfPreview.jsx";

const when = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—");
const Badge = ({ status }) => <span className={`pm-badge ${status}`}>{STATUS_LABEL[status] || status}</span>;
const Alert = ({ kind = "error", children }) => (children ? <div className={`pm-alert ${kind}`} role={kind === "error" ? "alert" : "status"}>{children}</div> : null);

function useAsync(load, key = "") {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });
  useEffect(() => {
    let live = true;
    loadRef.current().then(
      (data) => live && setState({ loading: false, data, error: "" }),
      (e) => live && setState({ loading: false, data: null, error: e.message })
    );
    return () => { live = false; };
  }, [key, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}

/* Only colours the customer actually changed are kept, exactly as the server and
   worker expect: an untouched swatch stays as the template has it. */
export function ColorFields({ value, onChange }) {
  const set = (key, raw) => {
    const hex = normalizeHex(raw);
    const next = { ...value };
    if (!hex || hex === normalizeHex(DEFAULT_COLORS[key])) delete next[key];
    else next[key] = hex;
    onChange(next);
  };
  return (
    <div className="pm-swatches">
      {BRAND_COLORS.map(({ key, label, hint }) => {
        const shown = value[key] || DEFAULT_COLORS[key];
        return (
          <div className="pm-swatch" key={key}>
            <input type="color" aria-label={label} value={shown.toLowerCase()} onChange={(e) => set(key, e.target.value)} />
            <div>
              <b style={{ fontSize: 13 }}>{label}</b><br />
              <code>{shown.toUpperCase()}{value[key] ? "" : " · template default"}</code>
              <div className="pm-hint">{hint}</div>
              {value[key] && <button type="button" className="pm-btn link" onClick={() => set(key, "")}>Reset</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Overview ── */

export function Overview({ user, verifyToken, onVerified }) {
  const { data, error, loading } = useAsync(() => api("GET", "overview"));
  const [verifyMsg, setVerifyMsg] = useState("");
  const [resent, setResent] = useState("");
  const tried = useRef(false);

  useEffect(() => {
    if (!verifyToken || tried.current) return;
    tried.current = true;
    api("POST", "verify-email", { token: verifyToken })
      .then(() => { setVerifyMsg("ok"); onVerified(); })
      .catch((e) => setVerifyMsg(e.message));
  }, [verifyToken, onVerified]);

  const resend = async () => {
    try { const r = await api("POST", "resend-verification"); setResent(r.delivered === false ? "We couldn't send the email just now. Try again shortly." : "Verification email sent."); }
    catch (e) { setResent(e.message); }
  };

  return (
    <>
      <div className="pm-top">
        <div><h1>Overview</h1><p className="pm-sub">Your production department at a glance.</p></div>
        <a className="pm-btn primary big" href="#/new">Create new job</a>
      </div>
      {verifyMsg === "ok" && <Alert kind="ok">Email verified. You can submit production jobs.</Alert>}
      {verifyMsg && verifyMsg !== "ok" && <Alert>{verifyMsg}</Alert>}
      {!user.emailVerified && verifyMsg !== "ok" && (
        <Alert kind="warn">
          Verify <b>{user.email}</b> to submit production jobs. Check your inbox, or{" "}
          <button className="pm-btn link" onClick={resend}>resend the link</button>. {resent}
        </Alert>
      )}
      <Alert>{error}</Alert>
      {loading && <p className="pm-sub">Loading…</p>}
      {data && <>
        <div className="pm-grid">
          <div className="pm-stat"><b>{data.totals.jobs}</b><span>Production jobs submitted</span></div>
          <div className="pm-stat"><b>{data.totals.processing}</b><span>In production now</span></div>
          <div className="pm-stat"><b>{data.totals.proofReady}</b><span>Awaiting your approval</span></div>
          <div className="pm-stat"><b>{data.totals.completed}</b><span>Completed</span></div>
          <div className="pm-stat"><b>{data.totals.drafts}</b><span>Drafts</span></div>
          <div className="pm-stat"><b>{data.totals.submittedThisMonth}</b><span>Jobs this month</span></div>
        </div>
        <div className="pm-card">
          <h2>Production worker</h2>
          {data.worker.online
            ? <Alert kind="ok">Connected — last seen {when(data.worker.lastSeenAt)}. {data.worker.queued} job(s) waiting.</Alert>
            : <Alert kind="warn">No production worker is connected{data.worker.lastSeenAt ? ` (last seen ${when(data.worker.lastSeenAt)})` : ""}. Jobs you submit are saved and queued ({data.worker.queued} waiting) and will start when the Mac worker comes online.</Alert>}
          <p className="pm-hint" style={{ margin: 0 }}>Subscription: billing is not set up yet — no charges apply.</p>
        </div>
        <div className="pm-card">
          <h2>Recent activity</h2>
          {data.activity.length === 0
            ? <div className="pm-empty">No activity yet. <a href="#/new">Create your first job.</a></div>
            : <ul className="pm-timeline">{data.activity.map((a, i) => (
              <li key={i}><a href={`#/projects/${a.projectId}`}>{a.projectName}</a> — {a.note}<time>{when(a.at)}</time></li>
            ))}</ul>}
        </div>
      </>}
    </>
  );
}

/* ── New job ── */

export function NewJob({ org }) {
  const { data: tpl } = useAsync(() => api("GET", "templates"));
  const [form, setForm] = useState({ name: "", customerName: org?.name || "", publicationTitle: org?.branding?.publicationTitle || "", templateId: "directory-classic" });
  const [colors, setColors] = useState(org?.branding?.colors || {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const create = async (event) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const { project } = await api("POST", "projects", { ...form, brandColors: colors });
      window.location.hash = `/projects/${project.id}`;
    } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <form onSubmit={create}>
      <div className="pm-top"><div><h1>New production job</h1><p className="pm-sub">Name it and choose a template. You'll upload your data next.</p></div></div>
      <Alert>{error}</Alert>
      <div className="pm-card">
        <h2>Project</h2>
        <div className="pm-row">
          <div className="pm-field"><label htmlFor="n">Project name</label><input id="n" value={form.name} onChange={set("name")} required placeholder="Spring 2027 member directory" /></div>
          <div className="pm-field"><label htmlFor="c">Customer / company</label><input id="c" value={form.customerName} onChange={set("customerName")} /></div>
        </div>
        <div className="pm-field"><label htmlFor="t">Publication title</label><input id="t" value={form.publicationTitle} onChange={set("publicationTitle")} />
          <span className="pm-hint">Saved with the project. Directory Classic doesn't yet place this on the page automatically.</span></div>
      </div>
      <div className="pm-card">
        <h2>Template</h2>
        {(tpl?.templates || []).map((t) => (
          <label key={t.id} className="pm-tpl" style={{ cursor: "pointer" }}>
            <img src={t.thumbnail} alt="" />
            <div><input type="radio" name="tpl" checked={form.templateId === t.id} onChange={() => setForm({ ...form, templateId: t.id })} /> <b>{t.name}</b>
              <div className="pm-hint">{t.category} · {t.trimSize.width}×{t.trimSize.height} in</div><p style={{ margin: "6px 0 0" }}>{t.description}</p></div>
          </label>
        ))}
      </div>
      <div className="pm-card">
        <h2>Brand colours</h2>
        <p className="pm-hint">Applied to the template's matching InDesign swatches. Leave a colour at its default to keep the template's own.</p>
        <ColorFields value={colors} onChange={setColors} />
      </div>
      <button className="pm-btn primary big" disabled={busy}>{busy ? "Creating…" : "Create project and continue"}</button>
    </form>
  );
}

/* ── Projects list ── */

export function Projects() {
  const { data, error, loading, reload } = useAsync(() => api("GET", "projects"));
  const [showArchived, setShowArchived] = useState(false);
  const [actionError, setActionError] = useState("");
  const act = async (method, path, body) => {
    setActionError("");
    try { await api(method, path, body); reload(); } catch (e) { setActionError(e.message); }
  };
  const rows = (data?.projects || []).filter((p) => p.archived === showArchived);
  return (
    <>
      <div className="pm-top">
        <div><h1>My projects</h1><p className="pm-sub">Every production job, saved and ready to revisit.</p></div>
        <a className="pm-btn primary" href="#/new">Create new job</a>
      </div>
      <Alert>{error || actionError}</Alert>
      <div className="pm-card">
        <div style={{ marginBottom: 12 }}>
          <label><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived</label>
        </div>
        {loading ? <p className="pm-sub">Loading…</p> : rows.length === 0 ? (
          <div className="pm-empty">{showArchived ? "No archived projects." : <>No projects yet. <a href="#/new">Create your first job.</a></>}</div>
        ) : (
          <div className="pm-scroll"><table className="pm-table">
            <thead><tr><th>Project</th><th>Template</th><th>Status</th><th>Records</th><th>Updated</th><th /></tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.id}>
                <td><a href={`#/projects/${p.id}`}><b>{p.name}</b></a><div className="pm-hint">{p.customerName}</div></td>
                <td>{p.templateId}</td><td><Badge status={p.status} /></td><td>{p.csv?.rowCount ?? "—"}</td><td>{when(p.updatedAt)}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="pm-btn link" onClick={() => act("POST", `projects/${p.id}/duplicate`, {})}>Duplicate</button>{" · "}
                  <button className="pm-btn link" onClick={() => act("POST", `projects/${p.id}/archive`, { archived: !p.archived })}>{p.archived ? "Restore" : "Archive"}</button>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}

/* ── Proof review ── */

function ProofReview({ project, onChanged }) {
  const proofs = project.proofs;
  const latest = proofs.at(-1);
  const [shown, setShown] = useState(null); // null = latest
  const [zoom, setZoom] = useState(100);
  const [notes, setNotes] = useState("");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const proof = proofs.find((p) => p.version === shown) || latest;
  const pending = project.status === "proof_ready" && proof.version === latest.version && proof.decision === "pending";

  const decide = async (kind) => {
    setBusy(kind); setError("");
    try {
      await api("POST", `projects/${project.id}/proofs/${proof.version}/${kind}`, kind === "revise" ? { notes } : {});
      setAsking(false); setNotes(""); onChanged();
    } catch (e) { setError(e.message); }
    finally { setBusy(""); }
  };
  const approve = () => {
    if (window.confirm("Approve this proof? The project will be locked and the final PDF produced from exactly what you see.")) decide("approve");
  };

  return (
    <div className="pm-card">
      <h2>Proof review</h2>
      <div className="pm-viewer-bar">
        {proofs.length > 1 && (
          <select aria-label="Proof version" value={proof.version} onChange={(e) => setShown(Number(e.target.value))}>
            {proofs.map((p) => <option key={p.version} value={p.version}>Version {p.version} — {p.decision.replace("_", " ")}</option>)}
          </select>
        )}
        <button className="pm-btn" onClick={() => setZoom((z) => Math.max(50, z - 25))} aria-label="Zoom out">−</button>
        <span aria-live="polite">{zoom}%</span>
        <button className="pm-btn" onClick={() => setZoom((z) => Math.min(250, z + 25))} aria-label="Zoom in">+</button>
        <a className="pm-btn" href={`${proof.url}?download=1`}>Download this proof</a>
      </div>
      <div className="pm-viewer">
        <div style={{ width: `${zoom}%`, margin: "0 auto" }}>
          <PdfPreview key={`${project.id}-${proof.version}`} url={proof.url} title={`Proof v${proof.version}`} />
        </div>
      </div>
      <p className="pm-hint">
        Version {proof.version} created {when(proof.createdAt)}
        {proof.decision !== "pending" && <> · {proof.decision.replace("_", " ")} by {proof.decidedBy} on {when(proof.decidedAt)}</>}
        {proof.notes && <> · “{proof.notes}”</>}
      </p>
      <Alert>{error}</Alert>
      {pending && (asking ? (
        <div>
          <div className="pm-field"><label htmlFor="rn">What needs to change?</label>
            <textarea id="rn" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} /></div>
          <button className="pm-btn primary" disabled={busy || notes.trim().length < 3} onClick={() => decide("revise")}>{busy === "revise" ? "Sending…" : "Send revision request"}</button>{" "}
          <button className="pm-btn" onClick={() => setAsking(false)}>Cancel</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="pm-btn primary big" disabled={!!busy} onClick={approve}>{busy === "approve" ? "Approving…" : "Approve proof"}</button>
          <button className="pm-btn big" disabled={!!busy} onClick={() => setAsking(true)}>Request revisions</button>
        </div>
      ))}
    </div>
  );
}

function FinalFile({ project }) {
  const f = project.finalFile;
  if (!f) return null;
  return (
    <div className="pm-card">
      <h2>Final PDF</h2>
      {f.validation.ok ? (
        <>
          <Alert kind="ok">Approved proof v{f.fromProof} — validated {when(f.createdAt)}.</Alert>
          <a className="pm-btn primary big" href={f.url}>Download final PDF</a>
        </>
      ) : <Alert>Validation failed: {f.validation.problems.join(" ")}</Alert>}
      <p className="pm-hint">Checked: {f.validation.checks.join("; ") || "—"}.<br />
        <b>Not checked yet:</b> {f.validation.notChecked.join(", ")}. Confirm these with your printer before sending to press.</p>
    </div>
  );
}

/* ── Project detail ── */

const STEPS = ["Settings", "Data", "Production", "Proof review", "Final PDF"];
const stepIndex = (s) => ({ draft: 1, uploaded: 2, queued: 2, processing: 2, failed: 2, revision_requested: 2, proof_ready: 3, approved: 4, completed: 5 }[s] ?? 0);

export function ProjectDetail({ id, user }) {
  const { data, error, reload } = useAsync(() => api("GET", `projects/${id}`), id);
  const project = data?.project;
  const [colors, setColors] = useState(null);
  const [meta, setMeta] = useState(null);
  const [msg, setMsg] = useState({ kind: "error", text: "" });
  const [busy, setBusy] = useState("");
  const active = project && ["queued", "processing"].includes(project.status);
  const locked = Boolean(project?.locked);

  /* Live progress: poll only while the job is actually in production. */
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(reload, 4000);
    return () => clearInterval(timer);
  }, [active, reload]);

  if (error) return <Alert>{error} <a href="#/projects">Back to projects</a></Alert>;
  if (!project) return <p className="pm-sub">Loading…</p>;

  const colorValue = colors ?? project.brandColors;
  const metaValue = meta ?? { name: project.name, customerName: project.customerName, publicationTitle: project.publicationTitle };
  const dirty = colors !== null || meta !== null;

  const run = async (label, fn) => {
    setBusy(label); setMsg({ kind: "error", text: "" });
    try { await fn(); reload(); } catch (e) { setMsg({ kind: "error", text: e.message }); }
    finally { setBusy(""); }
  };
  const save = () => run("save", async () => {
    await api("PATCH", `projects/${id}`, { ...metaValue, brandColors: colorValue });
    setColors(null); setMeta(null); setMsg({ kind: "ok", text: "Settings saved." });
  });
  const upload = (file) => run("upload", async () => {
    const form = new FormData(); form.set("csv", file);
    await api("POST", `projects/${id}/csv`, form);
    setMsg({ kind: "ok", text: "Data uploaded and validated." });
  });
  const submit = () => run("submit", async () => {
    if (dirty) await api("PATCH", `projects/${id}`, { ...metaValue, brandColors: colorValue });
    setColors(null); setMeta(null);
    await api("POST", `projects/${id}/submit`, {});
    setMsg({ kind: "ok", text: "Submitted for production." });
  });

  const prod = project.production;
  const step = stepIndex(project.status);
  return (
    <>
      <div className="pm-top">
        <div>
          <p className="pm-hint" style={{ margin: 0 }}><a href="#/projects">Projects</a> / {project.templateId}</p>
          <h1>{project.name}</h1>
          <p className="pm-sub"><Badge status={project.status} /> &nbsp;{project.customerName}</p>
        </div>
        {project.finalFile?.url && <a className="pm-btn primary big" href={project.finalFile.url}>Download final PDF</a>}
      </div>

      <ol className="pm-steps" aria-label="Production stages">
        {STEPS.map((label, i) => <li key={label} className={i < step ? "done" : i === step ? "now" : ""}>{i + 1}. {label}</li>)}
      </ol>

      <Alert kind={project.status === "failed" ? "error" : project.production?.waitingForWorker ? "warn" : "info"}>
        <b>Next:</b> {nextAction(project)}
      </Alert>
      {!user.emailVerified && project.csv && <Alert kind="warn">Verify your email to submit this job (see Overview).</Alert>}
      <Alert kind={msg.kind}>{msg.text}</Alert>

      {prod && (
        <div className="pm-card">
          <h2>Production</h2>
          <div className="pm-bar" aria-hidden="true"><i style={{ width: `${Math.round((prod.progress || 0) * (prod.progress > 1 ? 1 : 100))}%` }} /></div>
          <p className="pm-hint">{prod.message || "—"} {prod.error && <b style={{ color: "var(--danger)" }}>{prod.error}</b>}</p>
        </div>
      )}

      {project.proofs.length > 0 && <ProofReview project={project} onChanged={reload} />}
      <FinalFile project={project} />

      <div className="pm-card">
        <h2>Data</h2>
        {project.csv ? (
          <p style={{ marginTop: 0 }}><b>{project.csv.filename}</b> — {project.csv.rowCount} records, uploaded {when(project.csv.uploadedAt)}</p>
        ) : <p className="pm-sub" style={{ marginTop: 0 }}>No data uploaded yet.</p>}
        {!active && !locked && (
          <div className="pm-drop">
            <input type="file" accept=".csv,text/csv" aria-label="CSV file" disabled={busy === "upload"} onChange={(e) => e.target.files[0] && upload(e.target.files[0])} />
            <p className="pm-hint" style={{ marginBottom: 0 }}>
              {busy === "upload" ? "Uploading and validating…" : <>CSV with columns <code>last_name, first_name, address, phone, email</code> (optional: <code>alternate_phone, alternate_email, family_members</code>). <a href="/csv-templates/directory-classic-template.csv" download>Download the template</a>. Directory Classic is text-only — photos aren't placed by this template.</>}
            </p>
          </div>
        )}
        {project.preview && (
          <div className="pm-scroll" style={{ marginTop: 14 }}>
            <p className="pm-label">Preview — first {project.preview.rows.length} of {project.preview.rowCount}</p>
            <table className="pm-table"><thead><tr>{project.preview.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{project.preview.rows.map((r, i) => <tr key={i}>{project.preview.headers.map((h) => <td key={h}>{r[h]}</td>)}</tr>)}</tbody></table>
          </div>
        )}
      </div>

      <div className="pm-card">
        <h2>Settings & branding</h2>
        <fieldset disabled={active || locked} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="pm-row">
            <div className="pm-field"><label>Project name</label><input value={metaValue.name} onChange={(e) => setMeta({ ...metaValue, name: e.target.value })} /></div>
            <div className="pm-field"><label>Customer / company</label><input value={metaValue.customerName} onChange={(e) => setMeta({ ...metaValue, customerName: e.target.value })} /></div>
          </div>
          <ColorFields value={colorValue} onChange={setColors} />
          <div style={{ marginTop: 14 }}><button className="pm-btn" onClick={save} disabled={!dirty || busy === "save"}>{busy === "save" ? "Saving…" : "Save settings"}</button></div>
        </fieldset>
      </div>

      <div className="pm-card">
        <h2>Submit for production</h2>
        <button className="pm-btn primary big" onClick={submit} disabled={!project.csv || active || locked || busy === "submit" || !user.emailVerified}>
          {busy === "submit" ? "Submitting…" : ["proof_ready", "failed", "revision_requested"].includes(project.status) ? "Resubmit for production" : "Submit for production"}
        </button>
        <p className="pm-hint">Your CSV and colours are sent to the typesetting worker. A new proof replaces the previous one; earlier runs stay in the history below.</p>
      </div>

      <div className="pm-card">
        <h2>History</h2>
        <ul className="pm-timeline">{[...project.history].reverse().map((h, i) => <li key={i}>{h.note}<time>{when(h.at)}</time></li>)}</ul>
      </div>
    </>
  );
}

/* ── Templates ── */

export function Templates() {
  const { data, error } = useAsync(() => api("GET", "templates"));
  return (
    <>
      <div className="pm-top"><div><h1>Templates</h1><p className="pm-sub">Publication designs available for production today.</p></div></div>
      <Alert>{error}</Alert>
      {(data?.templates || []).map((t) => (
        <div className="pm-card pm-tpl" key={t.id}>
          <img src={t.thumbnail} alt={`${t.name} page artwork`} />
          <div>
            <h2 style={{ marginBottom: 2 }}>{t.name}</h2>
            <p className="pm-hint" style={{ marginTop: 0 }}>{t.category} · Trim {t.trimSize.width} × {t.trimSize.height} in</p>
            <p>{t.description}</p>
            <p className="pm-label">Data columns</p>
            <p className="pm-hint">Required: {t.csv.required.join(", ")}. Optional: {t.csv.optional.join(", ")}. Up to {t.csv.maxRows} rows.</p>
            <p className="pm-label">Customization</p>
            <p className="pm-hint">Colours: {t.customization.map((c) => c.label).join(", ")}. Photos: {t.supports.photos ? "yes" : "not supported"}. Logo: {t.supports.logo ? "yes" : "not supported"}.</p>
            <a className="pm-btn primary" href="#/new">Use this template</a>
          </div>
        </div>
      ))}
    </>
  );
}

/* ── Settings ── */

export function Settings({ session, onChanged }) {
  const { org, user } = session;
  const [profile, setProfile] = useState({ name: org.name, contactEmail: org.contactEmail, phone: org.phone, website: org.website, address: org.address });
  const [colors, setColors] = useState(org.branding.colors || {});
  const [title, setTitle] = useState(org.branding.publicationTitle || "");
  const [msg, setMsg] = useState({ kind: "ok", text: "" });
  const set = (key) => (e) => setProfile({ ...profile, [key]: e.target.value });
  const wrap = (fn, okText) => async (event) => {
    event.preventDefault();
    try { await fn(); setMsg({ kind: "ok", text: okText }); onChanged(); } catch (e) { setMsg({ kind: "error", text: e.message }); }
  };
  return (
    <>
      <div className="pm-top"><div><h1>Account settings</h1><p className="pm-sub">Signed in as {user.email}</p></div></div>
      <Alert kind={msg.kind}>{msg.text}</Alert>
      <form className="pm-card" onSubmit={wrap(() => api("PATCH", "org", profile), "Business profile saved.")}>
        <h2>Business profile</h2>
        <div className="pm-row">
          <div className="pm-field"><label>Company name</label><input value={profile.name} onChange={set("name")} required /></div>
          <div className="pm-field"><label>Contact email</label><input type="email" value={profile.contactEmail} onChange={set("contactEmail")} /></div>
          <div className="pm-field"><label>Phone</label><input value={profile.phone} onChange={set("phone")} /></div>
          <div className="pm-field"><label>Website</label><input value={profile.website} onChange={set("website")} /></div>
        </div>
        <div className="pm-field"><label>Address</label><textarea rows={2} value={profile.address} onChange={set("address")} /></div>
        <button className="pm-btn primary">Save profile</button>
      </form>
      <form className="pm-card" onSubmit={wrap(() => api("PUT", "org/branding", { colors, publicationTitle: title }), "Default branding saved. New projects will start with it.")}>
        <h2>Default branding</h2>
        <p className="pm-hint">New projects start with these colours and title. Existing projects are unchanged.</p>
        <div className="pm-field"><label>Default publication title</label><input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <ColorFields value={colors} onChange={setColors} />
        <div style={{ marginTop: 14 }}><button className="pm-btn primary">Save branding</button></div>
      </form>
    </>
  );
}
