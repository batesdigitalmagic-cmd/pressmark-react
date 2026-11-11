/*
 * Accounts, organizations and projects, on the same Upstash Redis the render
 * queue uses (locally: its in-process emulation — see lib/render-jobs/kv.js).
 *
 * Tenancy rule: every project key embeds nothing guessable, but ACCESS is
 * decided by `project.orgId === membership.orgId`, checked in getProjectForOrg().
 * No function here returns a project without being handed the org to check.
 *
 *   plat:user:<id>            user JSON (passwordHash, sessionVersion, emailVerified)
 *   plat:email:<email>        user id (SET NX makes registration race-safe)
 *   plat:org:<id>             organization JSON (profile + default branding)
 *   plat:org:<id>:members     set of "<userId>:<role>"
 *   plat:user:<id>:orgs       set of org ids
 *   plat:org:<id>:projects    set of project ids
 *   plat:project:<id>         project JSON
 *   plat:verify:<hash>        user id, EX 24h
 *   plat:reset:<hash>         user id, EX 1h
 */

import { randomBytes } from "node:crypto";
import { platformCommand as command, platformStoreConfigured, platformStoreProblem } from "./redis.js";
import { StorageUnavailableError } from "../render-jobs/storage-errors.js";

const rid = () => randomBytes(16).toString("hex");
const nowIso = () => new Date().toISOString();
export const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

function need() {
  const problem = platformStoreProblem();
  if (problem) throw new StorageUnavailableError(problem);
  if (!platformStoreConfigured()) {
    throw new StorageUnavailableError(
      "Accounts need a Redis database. Set KV_REST_API_URL and KV_REST_API_TOKEN, or a dedicated PLATFORM_REDIS_REST_URL and PLATFORM_REDIS_REST_TOKEN."
    );
  }
}

const parse = (raw) => {
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
};
const get = async (key) => parse(await command(["GET", key]));
const put = (key, value) => command(["SET", key, JSON.stringify(value)]);

/* ── Users & organizations ── */

export async function getUser(userId) {
  need();
  return get(`plat:user:${userId}`);
}

export async function getUserByEmail(email) {
  need();
  const id = await command(["GET", `plat:email:${normalizeEmail(email)}`]);
  return id ? getUser(id) : null;
}

/** Creates the user, their organization and the owner membership. Null if the email is taken. */
export async function createAccount({ email, passwordHash, name, companyName }) {
  need();
  const user = {
    id: rid(),
    email: normalizeEmail(email),
    name: String(name || "").trim().slice(0, 120),
    passwordHash,
    emailVerified: false,
    sessionVersion: 1,
    createdAt: nowIso(),
  };
  const claimed = await command(["SET", `plat:email:${user.email}`, user.id, "NX"]);
  if (claimed !== "OK") return null;

  const org = {
    id: rid(),
    name: String(companyName || "").trim().slice(0, 160),
    contactEmail: user.email,
    phone: "",
    website: "",
    address: "",
    branding: { colors: {}, publicationTitle: "" },
    createdAt: nowIso(),
  };
  await put(`plat:user:${user.id}`, user);
  await put(`plat:org:${org.id}`, org);
  await command(["SADD", `plat:org:${org.id}:members`, `${user.id}:owner`]);
  await command(["SADD", `plat:user:${user.id}:orgs`, org.id]);
  return { user, org };
}

export async function saveUser(user) {
  need();
  await put(`plat:user:${user.id}`, user);
  return user;
}

export async function getOrg(orgId) {
  need();
  return get(`plat:org:${orgId}`);
}

export async function saveOrg(org) {
  need();
  await put(`plat:org:${org.id}`, org);
  return org;
}

/** The org a user acts for. Single-org today; the membership set already allows more. */
export async function membershipFor(userId) {
  need();
  const orgIds = await command(["SMEMBERS", `plat:user:${userId}:orgs`]);
  const orgId = Array.isArray(orgIds) ? [...orgIds].sort()[0] : null;
  if (!orgId) return null;
  const members = await command(["SMEMBERS", `plat:org:${orgId}:members`]);
  const entry = (members || []).find((m) => m.startsWith(`${userId}:`));
  return entry ? { orgId, role: entry.split(":")[1] } : null;
}

export async function issueOneTimeToken(kind, hash, userId, seconds) {
  need();
  await command(["SET", `plat:${kind}:${hash}`, userId, "EX", String(seconds)]);
}

/** Single use: reading it deletes it. */
export async function consumeOneTimeToken(kind, hash) {
  need();
  const key = `plat:${kind}:${hash}`;
  const userId = await command(["GET", key]);
  if (!userId) return null;
  await command(["DEL", key]);
  return userId;
}

/* ── Projects ── */

export const PROJECT_STATUSES = [
  "draft", "uploaded", "queued", "processing", "proof_ready", "revision_requested", "approved", "completed", "failed",
];

export async function createProject(orgId, fields) {
  need();
  const project = {
    id: rid(),
    orgId,
    name: fields.name,
    customerName: fields.customerName || "",
    projectType: fields.projectType || "Contact Directory",
    templateId: fields.templateId,
    publicationTitle: fields.publicationTitle || "",
    brandColors: fields.brandColors || {},
    status: "draft",
    csv: null,
    jobId: null,
    jobIds: [],
    proofs: [],
    finalFile: null,
    archived: false,
    history: [{ at: nowIso(), event: "created", note: "Project created" }],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await put(`plat:project:${project.id}`, project);
  await command(["SADD", `plat:org:${orgId}:projects`, project.id]);
  return project;
}

/** The ONLY read path for a project. Wrong org is indistinguishable from missing. */
export async function getProjectForOrg(orgId, projectId) {
  need();
  if (!/^[a-f0-9]{32}$/.test(projectId || "")) return null;
  const project = await get(`plat:project:${projectId}`);
  return project && project.orgId === orgId ? project : null;
}

export async function listProjectsForOrg(orgId) {
  need();
  const ids = (await command(["SMEMBERS", `plat:org:${orgId}:projects`])) || [];
  const projects = (await Promise.all(ids.map((id) => get(`plat:project:${id}`)))).filter(
    (project) => project && project.orgId === orgId
  );
  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveProject(project, historyEntry) {
  need();
  const next = { ...project, updatedAt: nowIso() };
  if (historyEntry) next.history = [...project.history, { at: nowIso(), ...historyEntry }].slice(-200);
  await put(`plat:project:${next.id}`, next);
  return next;
}

export const csvObjectKey = (orgId, projectId) => `platform/${orgId}/${projectId}/input.csv`;

/* Proofs and final files are copied out of the job's 90-day store into keys that
   belong to the project, so an approved file outlives job retention. */
export const proofObjectKey = (orgId, projectId, version) => `platform/${orgId}/${projectId}/proof-v${version}.pdf`;
export const finalObjectKey = (orgId, projectId, version) => `platform/${orgId}/${projectId}/final-v${version}.pdf`;
