/*
 * The /api/platform router: accounts, organizations, projects, production jobs.
 *
 * SERVER ONLY. One entry point (api/platform/[...path].js) keeps this under
 * Vercel's function-count ceiling and lets the tests drive the real router.
 *
 * Authorization model: every route except register/login/verify/reset calls
 * authenticate(), which yields {user, orgId, role}. Projects are only ever
 * fetched through getProjectForOrg(orgId, id), so a foreign project id is a 404
 * indistinguishable from a missing one.
 */

import { randomBytes } from "node:crypto";
import { validateBrandColors } from "../../src/instant-proof/colors.js";
import { clientIp, rateLimit, tooManyRequests } from "../rate-limit.js";
import { validateAndNormalizeCsv } from "../render-jobs/csv.js";
import { apiError, json } from "../render-jobs/http.js";
import { assertRenderStorage } from "../render-jobs/storage.js";
import { createJob, readJob, readWorkerSeen, queueDepth, JOB_STATUSES } from "../render-jobs/jobs.js";
import { getObject, inputCsvPath, outputPdfPath, putObject, readOutputPdf, streamObject } from "../render-jobs/blob.js";
import { validatePdf } from "./pdf-validate.js";
import { command } from "../render-jobs/kv.js";
import {
  clearedCookie, cookieFrom, createSessionToken, hashOneTimeToken, hashPassword, newOneTimeToken,
  passwordProblem, readSessionToken, sameOrigin, sessionCookie, sessionSecretConfigured, verifyPassword,
} from "./auth.js";
import {
  consumeOneTimeToken, createAccount, createProject, csvObjectKey, finalObjectKey, getOrg, proofObjectKey, getProjectForOrg, getUser,
  getUserByEmail, issueOneTimeToken, listProjectsForOrg, membershipFor, normalizeEmail, saveOrg,
  saveProject, saveUser,
} from "./store.js";
import { TEMPLATES, templateById } from "./templates.js";
import { sendResetEmail, sendVerificationEmail } from "./mail.js";

/* Account projects keep their proof for 90 days (the anonymous flow keeps 48h). */
const PROJECT_RETENTION_SECONDS = Number(process.env.PRESSMARK_PROJECT_RETENTION_SECONDS) || 90 * 24 * 3600;
const MAX_CSV_BYTES = Number(process.env.PRESSMARK_RENDER_MAX_CSV_BYTES) || 2 * 1024 * 1024;
const MAX_ROWS = Number(process.env.PRESSMARK_RENDER_MAX_ROWS) || 5000;
const ACTIVE = new Set(["queued", "processing"]);
/* Once approved, the data and settings that produced the file are frozen; to change
   anything the customer duplicates the project. */
const LOCKED = new Set(["approved", "completed"]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const text = (value, max) => String(value ?? "").trim().slice(0, max);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const bad = (message) => new HttpError(400, message);

/* Tokens are returned to the caller only in local/test mode, where there is no
   mailbox. In any deployed environment they exist only in the email. */
const exposeTokens = () => process.env.PRESSMARK_RENDER_STORAGE === "local" || process.env.NODE_ENV === "test";

async function body(request) {
  try {
    return (await request.json()) || {};
  } catch {
    throw bad("Send a JSON body.");
  }
}

/* ── Authentication ── */

async function authenticate(request) {
  const session = readSessionToken(cookieFrom(request));
  if (!session) throw new HttpError(401, "Sign in to continue.");
  const user = await getUser(session.userId);
  if (!user || user.sessionVersion !== session.version) throw new HttpError(401, "Sign in to continue.");
  const membership = await membershipFor(user.id);
  if (!membership) throw new HttpError(403, "This account has no organization.");
  return { user, orgId: membership.orgId, role: membership.role };
}

const publicUser = (user) => ({ id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerified });
const publicOrg = (org) => ({
  id: org.id, name: org.name, contactEmail: org.contactEmail, phone: org.phone, website: org.website,
  address: org.address, branding: org.branding,
});

async function sessionResponse(request, user, status = 200) {
  const response = json(await mePayload(user), status);
  response.headers.append("Set-Cookie", sessionCookie(request, createSessionToken(user)));
  return response;
}

async function mePayload(user) {
  const membership = await membershipFor(user.id);
  const org = membership ? await getOrg(membership.orgId) : null;
  return { user: publicUser(user), org: org ? publicOrg(org) : null, role: membership?.role ?? null };
}

async function sendToken(kind, user, send) {
  const token = newOneTimeToken();
  await issueOneTimeToken(kind, hashOneTimeToken(token), user.id, kind === "verify" ? 86400 : 3600);
  let delivered = false;
  try {
    await send(user.email, token);
    delivered = true;
  } catch (error) {
    console.error(`[platform] ${kind} email failed:`, error?.message);
  }
  return { token, delivered };
}

const routes = [];
const route = (method, pattern, handler) => routes.push({ method, pattern: new RegExp(`^${pattern}$`), handler });

route("POST", "register", async (request) => {
  const limited = await rateLimit("platform-register", clientIp(request), { limit: 8, windowSeconds: 3600 });
  if (!limited.ok) return tooManyRequests(limited.resetSeconds);
  const input = await body(request);
  const email = normalizeEmail(input.email);
  if (!EMAIL_RE.test(email)) throw bad("Enter a valid email address.");
  const problem = passwordProblem(input.password);
  if (problem) throw bad(problem);
  const companyName = text(input.companyName, 160);
  if (!companyName) throw bad("Enter your company name.");

  const account = await createAccount({
    email, passwordHash: await hashPassword(input.password), name: text(input.name, 120), companyName,
  });
  /* Same response either way: registration must not reveal which emails have accounts. */
  const generic = { message: "Check your email to verify your account, then sign in." };
  if (!account) return json(generic, 202);

  const { token } = await sendToken("verify", account.user, sendVerificationEmail);
  const response = await sessionResponse(request, account.user, 201);
  if (exposeTokens()) {
    const payload = await response.clone().json();
    return new Response(JSON.stringify({ ...payload, devVerificationToken: token }), {
      status: 201, headers: response.headers,
    });
  }
  return response;
});

route("POST", "login", async (request) => {
  const limited = await rateLimit("platform-login", clientIp(request), { limit: 15, windowSeconds: 900 });
  if (!limited.ok) return tooManyRequests(limited.resetSeconds);
  const input = await body(request);
  const user = await getUserByEmail(input.email);
  const ok = await verifyPassword(String(input.password ?? ""), user?.passwordHash);
  if (!user || !ok) throw new HttpError(401, "Email or password is incorrect.");
  return sessionResponse(request, user);
});

route("POST", "logout", async (request) => {
  const response = json({ ok: true });
  response.headers.append("Set-Cookie", clearedCookie(request));
  return response;
});

route("POST", "verify-email", async (request) => {
  const input = await body(request);
  const userId = await consumeOneTimeToken("verify", hashOneTimeToken(String(input.token || "")));
  if (!userId) throw bad("That verification link is invalid or has expired.");
  const user = await getUser(userId);
  await saveUser({ ...user, emailVerified: true });
  return json({ ok: true });
});

route("POST", "resend-verification", async (request) => {
  const { user } = await authenticate(request);
  const limited = await rateLimit("platform-resend", user.id, { limit: 5, windowSeconds: 3600 });
  if (!limited.ok) return tooManyRequests(limited.resetSeconds);
  if (user.emailVerified) return json({ ok: true });
  const { token, delivered } = await sendToken("verify", user, sendVerificationEmail);
  return json({ ok: true, delivered, ...(exposeTokens() ? { devVerificationToken: token } : {}) });
});

route("POST", "request-reset", async (request) => {
  const limited = await rateLimit("platform-reset", clientIp(request), { limit: 6, windowSeconds: 3600 });
  if (!limited.ok) return tooManyRequests(limited.resetSeconds);
  const user = await getUserByEmail((await body(request)).email);
  let devToken;
  if (user) devToken = (await sendToken("reset", user, sendResetEmail)).token;
  return json({ message: "If that email has an account, a reset link is on its way.", ...(exposeTokens() && devToken ? { devResetToken: devToken } : {}) });
});

route("POST", "reset-password", async (request) => {
  const input = await body(request);
  const problem = passwordProblem(input.password);
  if (problem) throw bad(problem);
  const userId = await consumeOneTimeToken("reset", hashOneTimeToken(String(input.token || "")));
  if (!userId) throw bad("That reset link is invalid or has expired.");
  const user = await getUser(userId);
  /* New version signs every existing session out. A reset proves mailbox control. */
  await saveUser({ ...user, passwordHash: await hashPassword(input.password), sessionVersion: user.sessionVersion + 1, emailVerified: true });
  return json({ ok: true });
});

route("GET", "me", async (request) => json(await mePayload((await authenticate(request)).user)));

/* ── Organization ── */

route("PATCH", "org", async (request) => {
  const { orgId, role } = await authenticate(request);
  if (!["owner", "admin"].includes(role)) throw new HttpError(403, "Only an owner or admin can edit the business profile.");
  const input = await body(request);
  const org = await getOrg(orgId);
  const name = input.name === undefined ? org.name : text(input.name, 160);
  if (!name) throw bad("Company name cannot be empty.");
  const contactEmail = input.contactEmail === undefined ? org.contactEmail : normalizeEmail(input.contactEmail);
  if (!EMAIL_RE.test(contactEmail)) throw bad("Enter a valid contact email.");
  const next = {
    ...org, name, contactEmail,
    phone: input.phone === undefined ? org.phone : text(input.phone, 40),
    website: input.website === undefined ? org.website : text(input.website, 200),
    address: input.address === undefined ? org.address : text(input.address, 400),
  };
  await saveOrg(next);
  return json({ org: publicOrg(next) });
});

route("PUT", "org/branding", async (request) => {
  const { orgId } = await authenticate(request);
  const input = await body(request);
  const validated = validateBrandColors(input.colors || {});
  if (!validated.ok) throw bad(validated.error);
  const org = await getOrg(orgId);
  const next = { ...org, branding: { colors: validated.colors, publicationTitle: text(input.publicationTitle, 200) } };
  await saveOrg(next);
  return json({ org: publicOrg(next) });
});

route("GET", "templates", async (request) => {
  await authenticate(request);
  return json({ templates: TEMPLATES });
});

/* ── Projects ── */

const JOB_TO_PROJECT = {
  [JOB_STATUSES.queued]: "queued",
  [JOB_STATUSES.claimed]: "processing",
  [JOB_STATUSES.rendering]: "processing",
  [JOB_STATUSES.completed]: "proof_ready",
  [JOB_STATUSES.failed]: "failed",
};

/* The render job is the source of truth for production state; the project row
   is brought into line whenever it is read, and the change is logged.
   A completed job becomes a numbered proof exactly once. */
async function syncWithJob(project) {
  project = { ...project, proofs: project.proofs ?? [], finalFile: project.finalFile ?? null };
  if (!project.jobId) return { project, job: null };
  const job = await readJob(project.jobId).catch(() => null);
  if (!job) {
    if (ACTIVE.has(project.status)) {
      return { project: await saveProject({ ...project, status: "failed" }, { event: "failed", note: "The production job expired before it finished." }), job: null };
    }
    return { project, job: null };
  }
  if (job.status === JOB_STATUSES.completed) {
    if (project.proofs.some((proof) => proof.jobId === job.jobId)) return { project, job };
    /* One writer per transition: a concurrent poll that loses this race simply
       shows the previous state and picks the proof up on its next read. */
    const won = await command(["SET", `plat:proof:${job.jobId}`, "1", "NX", "EX", "60"]);
    if (won !== "OK") return { project, job };
    const bytes = await readOutputPdf(job.jobId);
    if (!bytes) return { project, job };
    const version = project.proofs.length + 1;
    await putObject(proofObjectKey(project.orgId, project.id, version), bytes, "application/pdf");
    const proofs = project.proofs.map((proof) => (proof.decision === "pending" ? { ...proof, decision: "superseded" } : proof));
    proofs.push({ version, jobId: job.jobId, createdAt: new Date().toISOString(), bytes: bytes.length, decision: "pending", decidedAt: null, decidedBy: null, notes: "" });
    return { project: await saveProject({ ...project, proofs, status: "proof_ready" }, { event: "proof_ready", note: `Proof v${version} is ready for your review` }), job };
  }
  const mapped = JOB_TO_PROJECT[job.status] || project.status;
  if (mapped !== project.status && !LOCKED.has(project.status)) {
    const note = mapped === "failed" ? job.errorMessage || "Production failed." : `Production ${mapped.replace("_", " ")}`;
    project = await saveProject({ ...project, status: mapped }, { event: mapped, note });
  }
  return { project, job };
}

async function view(project, { withPreview = false } = {}) {
  const synced = await syncWithJob(project);
  project = synced.project;
  const job = synced.job;
  const worker = await readWorkerSeen();
  const out = {
    id: project.id, name: project.name, customerName: project.customerName, projectType: project.projectType,
    templateId: project.templateId, publicationTitle: project.publicationTitle, brandColors: project.brandColors,
    status: project.status, csv: project.csv, locked: LOCKED.has(project.status), archived: project.archived, history: project.history,
    createdAt: project.createdAt, updatedAt: project.updatedAt,
    production: job ? {
      progress: job.progress ?? 0, message: job.progressMessage || "", attempts: job.attempts,
      error: job.status === JOB_STATUSES.failed ? job.errorMessage || "" : "",
      /* Visible, not hidden: a queued job with no connected Mac says so. */
      waitingForWorker: job.status === JOB_STATUSES.queued && !worker.online,
      completedAt: job.completedAt || null,
    } : null,
    proofs: project.proofs.map((proof) => ({
      version: proof.version, createdAt: proof.createdAt, decision: proof.decision, decidedAt: proof.decidedAt,
      decidedBy: proof.decidedBy, notes: proof.notes, url: `/api/platform/projects/${project.id}/proofs/${proof.version}/file`,
    })),
    finalFile: project.finalFile ? {
      version: project.finalFile.version, fromProof: project.finalFile.fromProof, createdAt: project.finalFile.createdAt,
      validation: project.finalFile.validation,
      url: project.finalFile.validation.ok ? `/api/platform/projects/${project.id}/final` : null,
    } : null,
  };
  if (withPreview && project.csv) {
    const bytes = await getObject(csvObjectKey(project.orgId, project.id));
    if (bytes) {
      const parsed = validateAndNormalizeCsv(bytes);
      out.preview = { headers: parsed.headers, rows: parsed.records.slice(0, 10), rowCount: parsed.rowCount };
    }
  }
  return out;
}

async function requireProject(orgId, id) {
  const raw = await getProjectForOrg(orgId, id);
  if (!raw) throw new HttpError(404, "Project not found.");
  /* Decisions and edits must see the live production state, not a stale row. */
  return (await syncWithJob(raw)).project;
}

function projectFields(input, org, existing) {
  const name = input.name === undefined ? existing?.name : text(input.name, 160);
  if (!name) throw bad("Give the project a name.");
  const colorsInput = input.brandColors === undefined ? (existing?.brandColors ?? org.branding.colors) : input.brandColors;
  const validated = validateBrandColors(colorsInput || {});
  if (!validated.ok) throw bad(validated.error);
  return {
    name,
    customerName: input.customerName === undefined ? (existing?.customerName ?? org.name) : text(input.customerName, 160),
    projectType: input.projectType === undefined ? (existing?.projectType ?? "Contact Directory") : text(input.projectType, 80),
    publicationTitle: input.publicationTitle === undefined ? (existing?.publicationTitle ?? org.branding.publicationTitle) : text(input.publicationTitle, 200),
    brandColors: validated.colors,
  };
}

route("GET", "projects", async (request) => {
  const { orgId } = await authenticate(request);
  const projects = await listProjectsForOrg(orgId);
  return json({ projects: await Promise.all(projects.map((p) => view(p))) });
});

route("POST", "projects", async (request) => {
  const { orgId } = await authenticate(request);
  const input = await body(request);
  const template = templateById(input.templateId);
  if (!template) throw bad("Choose an available template.");
  const org = await getOrg(orgId);
  const project = await createProject(orgId, { ...projectFields(input, org), templateId: template.id });
  return json({ project: await view(project) }, 201);
});

route("GET", "projects/([a-f0-9]{32})", async (request, [id]) => {
  const { orgId } = await authenticate(request);
  return json({ project: await view(await requireProject(orgId, id), { withPreview: true }) });
});

route("PATCH", "projects/([a-f0-9]{32})", async (request, [id]) => {
  const { orgId } = await authenticate(request);
  const project = await requireProject(orgId, id);
  if (ACTIVE.has(project.status)) throw new HttpError(409, "This project is in production; wait for it to finish before editing.");
  if (LOCKED.has(project.status)) throw new HttpError(409, "This project is approved and locked. Duplicate it to make changes.");
  const org = await getOrg(orgId);
  const saved = await saveProject({ ...project, ...projectFields(await body(request), org, project) }, { event: "edited", note: "Settings updated" });
  return json({ project: await view(saved) });
});

route("POST", "projects/([a-f0-9]{32})/csv", async (request, [id]) => {
  const { orgId } = await authenticate(request);
  assertRenderStorage();
  const project = await requireProject(orgId, id);
  if (ACTIVE.has(project.status)) throw new HttpError(409, "This project is in production; wait for it to finish before replacing data.");
  if (LOCKED.has(project.status)) throw new HttpError(409, "This project is approved and locked. Duplicate it to make changes.");
  const form = await request.formData().catch(() => null);
  const upload = form?.get("csv");
  if (!(upload instanceof File) || !upload.name.toLowerCase().endsWith(".csv")) throw bad("Upload one .csv file.");
  if (upload.size <= 0 || upload.size > MAX_CSV_BYTES) throw new HttpError(413, `CSV files must be no larger than ${Math.round(MAX_CSV_BYTES / 1024 / 1024)} MB.`);
  let parsed;
  try {
    parsed = validateAndNormalizeCsv(new Uint8Array(await upload.arrayBuffer()));
  } catch (error) {
    throw bad(error.message);
  }
  if (parsed.rowCount > MAX_ROWS) throw new HttpError(413, `This directory has ${parsed.rowCount} rows; the limit is ${MAX_ROWS}.`);

  await putObject(csvObjectKey(orgId, id), parsed.bytes, "text/csv; charset=utf-8");
  const filename = text(upload.name.split(/[\\/]/).pop(), 180);
  const saved = await saveProject(
    { ...project, status: "uploaded", csv: { filename, rowCount: parsed.rowCount, headers: parsed.headers, uploadedAt: new Date().toISOString() } },
    { event: "uploaded", note: `${filename} — ${parsed.rowCount} records` }
  );
  return json({ project: await view(saved, { withPreview: true }) });
});

route("POST", "projects/([a-f0-9]{32})/submit", async (request, [id]) => {
  const { orgId, user } = await authenticate(request);
  assertRenderStorage();
  if (!user.emailVerified) throw new HttpError(403, "Verify your email address before submitting production jobs.");
  const project = await requireProject(orgId, id);
  if (!project.csv) throw bad("Upload your CSV data before submitting.");
  if (ACTIVE.has(project.status)) throw new HttpError(409, "This project is already in production.");
  if (LOCKED.has(project.status)) throw new HttpError(409, "This project is already approved.");

  /* Two clicks, one job: the lock makes submission idempotent for 30 seconds. */
  const locked = await command(["SET", `plat:submit:${id}`, "1", "NX", "EX", "30"]);
  if (locked !== "OK") throw new HttpError(409, "This project is already being submitted.");

  let saved;
  try {
    const stored = await getObject(csvObjectKey(orgId, id));
    if (!stored) throw bad("The uploaded CSV is no longer available. Upload it again.");
    const parsed = validateAndNormalizeCsv(stored);

    const jobId = randomBytes(32).toString("hex");
    await putObject(inputCsvPath(jobId), parsed.bytes, "text/csv; charset=utf-8");
    await createJob({
      jobId, templateId: project.templateId, originalFilename: project.csv.filename, rowCount: parsed.rowCount,
      csvKey: inputCsvPath(jobId), pdfKey: outputPdfPath(jobId), mockOutput: false,
      brandColors: project.brandColors, orgId, projectId: id, retentionSeconds: PROJECT_RETENTION_SECONDS,
    });
    saved = await saveProject(
      { ...project, proofs: project.proofs ?? [], status: "queued", jobId, jobIds: [...project.jobIds, jobId] },
      { event: "submitted", note: `Submitted for production (run ${project.jobIds.length + 1})` }
    );
  } finally {
    await command(["DEL", `plat:submit:${id}`]);
  }
  return json({ project: await view(saved) }, 202);
});

route("POST", "projects/([a-f0-9]{32})/duplicate", async (request, [id]) => {
  const { orgId } = await authenticate(request);
  const source = await requireProject(orgId, id);
  const copy = await createProject(orgId, { ...source, name: `${source.name} (copy)` });
  let saved = copy;
  if (source.csv) {
    const bytes = await getObject(csvObjectKey(orgId, id));
    if (bytes) {
      await putObject(csvObjectKey(orgId, copy.id), bytes, "text/csv; charset=utf-8");
      saved = await saveProject({ ...copy, status: "uploaded", csv: source.csv }, { event: "uploaded", note: `Copied from ${source.name}` });
    }
  }
  return json({ project: await view(saved) }, 201);
});

route("POST", "projects/([a-f0-9]{32})/archive", async (request, [id]) => {
  const { orgId } = await authenticate(request);
  const project = await requireProject(orgId, id);
  if (ACTIVE.has(project.status)) throw new HttpError(409, "Wait for production to finish before archiving.");
  const archived = Boolean((await body(request)).archived);
  const saved = await saveProject({ ...project, archived }, { event: archived ? "archived" : "restored", note: archived ? "Archived" : "Restored" });
  return json({ project: await view(saved) });
});

function pdfResponse(file, filename, inline) {
  return new Response(file.stream, {
    headers: {
      ...(file.size ? { "Content-Length": String(file.size) } : {}),
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
const safeName = (name) => (name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "project").slice(0, 80);

route("GET", "projects/([a-f0-9]{32})/proofs/(\\d{1,3})/file", async (request, [id, version]) => {
  const { orgId } = await authenticate(request);
  assertRenderStorage();
  const project = await requireProject(orgId, id);
  const proof = project.proofs.find((p) => p.version === Number(version));
  if (!proof) throw new HttpError(404, "Proof not found.");
  const file = await streamObject(proofObjectKey(orgId, id, proof.version));
  if (!file) throw new HttpError(404, "The proof file is no longer available.");
  const download = new URL(request.url).searchParams.get("download") === "1";
  return pdfResponse(file, `${safeName(project.name)}-proof-v${proof.version}.pdf`, !download);
});

route("POST", "projects/([a-f0-9]{32})/proofs/(\\d{1,3})/approve", async (request, [id, version]) => {
  const { orgId, user } = await authenticate(request);
  assertRenderStorage();
  const project = await requireProject(orgId, id);
  const proof = project.proofs.find((p) => p.version === Number(version));
  if (!proof) throw new HttpError(404, "Proof not found.");
  /* Only the newest, still-undecided proof can be approved — never a superseded
     draft, and never twice. */
  if (proof.version !== project.proofs.length || proof.decision !== "pending" || project.status !== "proof_ready") {
    throw new HttpError(409, "This proof can no longer be approved.");
  }
  /* Claim the decision before doing the slow work, so two clicks cannot both finalize. */
  const claimed = await command(["SET", `plat:decide:${id}:${proof.version}`, "1", "NX", "EX", "120"]);
  if (claimed !== "OK") throw new HttpError(409, "This proof is already being approved.");

  const bytes = await getObject(proofObjectKey(orgId, id, proof.version));
  if (!bytes) throw new HttpError(404, "The proof file is no longer available.");
  const template = templateById(project.templateId);
  const validation = await validatePdf(bytes, { trim: template.trimSize });
  const at = new Date().toISOString();
  const proofs = project.proofs.map((p) => (p.version === proof.version ? { ...p, decision: "approved", decidedAt: at, decidedBy: user.email } : p));
  if (validation.ok) {
    await putObject(finalObjectKey(orgId, id, proof.version), bytes, "application/pdf");
  }
  const finalFile = { version: proof.version, fromProof: proof.version, createdAt: at, validation };
  const saved = await saveProject(
    { ...project, proofs, finalFile, status: validation.ok ? "completed" : "approved" },
    { event: "approved", note: `Proof v${proof.version} approved by ${user.email}` + (validation.ok ? " — final PDF validated" : " — final PDF failed validation: " + validation.problems.join(" ")) }
  );
  return json({ project: await view(saved) });
});

route("POST", "projects/([a-f0-9]{32})/proofs/(\\d{1,3})/revise", async (request, [id, version]) => {
  const { orgId, user } = await authenticate(request);
  const project = await requireProject(orgId, id);
  const proof = project.proofs.find((p) => p.version === Number(version));
  if (!proof) throw new HttpError(404, "Proof not found.");
  if (proof.version !== project.proofs.length || proof.decision !== "pending" || project.status !== "proof_ready") {
    throw new HttpError(409, "Revisions can only be requested on the latest proof awaiting review.");
  }
  const notes = text((await body(request)).notes, 2000);
  if (notes.length < 3) throw bad("Describe what needs to change.");
  const proofs = project.proofs.map((p) => (p.version === proof.version ? { ...p, decision: "revision_requested", decidedAt: new Date().toISOString(), decidedBy: user.email, notes } : p));
  const saved = await saveProject({ ...project, proofs, status: "revision_requested" }, { event: "revision_requested", note: `Revision requested on proof v${proof.version}: ${notes.slice(0, 200)}` });
  return json({ project: await view(saved) });
});

route("GET", "projects/([a-f0-9]{32})/final", async (request, [id]) => {
  const { orgId } = await authenticate(request);
  assertRenderStorage();
  const project = await requireProject(orgId, id);
  /* Only a file that was approved AND passed validation is ever served as final. */
  if (!project.finalFile?.validation?.ok) throw new HttpError(409, "There is no validated final PDF for this project.");
  const file = await streamObject(finalObjectKey(orgId, id, project.finalFile.version));
  if (!file) throw new HttpError(404, "The final PDF is no longer available.");
  return pdfResponse(file, `${safeName(project.name)}-final.pdf`, false);
});

route("GET", "overview", async (request) => {
  const { orgId } = await authenticate(request);
  const projects = (await listProjectsForOrg(orgId));
  const views = await Promise.all(projects.map((p) => view(p)));
  const live = views.filter((p) => !p.archived);
  const month = new Date().toISOString().slice(0, 7);
  const worker = await readWorkerSeen();
  const activity = views
    .flatMap((p) => p.history.map((h) => ({ ...h, projectId: p.id, projectName: p.name })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12);
  return json({
    totals: {
      jobs: views.reduce((n, p) => n + p.history.filter((h) => h.event === "submitted").length, 0),
      processing: live.filter((p) => ACTIVE.has(p.status)).length,
      proofReady: live.filter((p) => p.status === "proof_ready").length,
      revisions: live.filter((p) => p.status === "revision_requested").length,
      completed: live.filter((p) => p.status === "completed").length,
      drafts: live.filter((p) => ["draft", "uploaded"].includes(p.status)).length,
      failed: live.filter((p) => p.status === "failed").length,
      submittedThisMonth: views.reduce((n, p) => n + p.history.filter((h) => h.event === "submitted" && h.at.startsWith(month)).length, 0),
    },
    activity,
    worker: { online: worker.online, lastSeenAt: worker.lastSeenAt, queued: await queueDepth() },
    subscription: { status: "not_configured", note: "Billing launches in a later phase." },
  });
});

/* ── Dispatch ── */

export async function handlePlatform(request) {
  const path = new URL(request.url).pathname.replace(/^\/api\/platform\/?/, "").replace(/\/$/, "");
  try {
    if (!sessionSecretConfigured()) {
      return json({ error: "Accounts are not configured on this deployment. Set PLATFORM_SESSION_SECRET (32+ characters)." }, 503);
    }
    /* A Vercel Preview inherits Production's environment variables unless they are
       scoped separately. Left unchecked, a preview would write test accounts into
       the live Redis and Blob store, and Production's Mac worker would claim
       preview jobs because they share a queue. Refuse to run until the operator
       affirms the preview has its own storage and worker token. */
    if (process.env.VERCEL_ENV === "preview" && process.env.PRESSMARK_PREVIEW_ISOLATED !== "1") {
      return json({ error: "This preview is not marked isolated from production storage. Give the Preview environment its own KV_REST_API_*, BLOB_READ_WRITE_TOKEN and PRESSMARK_WORKER_TOKEN, then set PRESSMARK_PREVIEW_ISOLATED=1 for Preview only." }, 503);
    }
    if (request.method !== "GET" && !sameOrigin(request)) return json({ error: "Cross-site request refused." }, 403);

    let matchedPath = false;
    for (const candidate of routes) {
      const match = path.match(candidate.pattern);
      if (!match) continue;
      matchedPath = true;
      if (candidate.method !== request.method) continue;
      return await candidate.handler(request, match.slice(1));
    }
    return json({ error: matchedPath ? "Method not allowed" : "Not found" }, matchedPath ? 405 : 404);
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    return apiError(error);
  }
}
