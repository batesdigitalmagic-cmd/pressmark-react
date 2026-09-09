/*
 * The key-value backend for render-job state.
 *
 * SERVER ONLY. Never import from src/.
 *
 * ── One lifecycle, two backends ──
 *
 * Production talks to Upstash Redis over its REST API, reusing the credentials
 * already provisioned for licences. Local development and the test suite talk
 * to an in-process emulation of the same commands.
 *
 * The point of routing here rather than writing a second job store is that
 * jobs.js — the atomic claim, the lease compare-and-set, the recovery sweep —
 * is executed unchanged in both. A local adapter that reimplemented the
 * lifecycle would be a different program from the one that runs in production,
 * and the interesting bugs (two workers claiming one job, a lease renewed by a
 * worker that no longer owns it) are exactly the ones such a stand-in would
 * fail to reproduce. Here the tests exercise the real thing.
 *
 * The emulation covers only the commands jobs.js actually issues. It is not a
 * Redis; an unknown command throws rather than silently returning null, so a
 * command added to jobs.js without support here fails loudly in the test suite
 * instead of quietly misbehaving in production.
 */

import { command as upstashCommand, storeConfigured } from "../license-store.js";

/** True when the process should use the in-memory emulation. */
export function usingLocalKv() {
  return process.env.PRESSMARK_RENDER_STORAGE === "local" || process.env.NODE_ENV === "test";
}

export function kvConfigured() {
  return usingLocalKv() || storeConfigured;
}

/* ── The local emulation ──
   Module state, so it lives as long as the process and is shared by every
   import — which is what makes an atomic claim meaningful across the handlers
   a single test exercises. */
const store = new Map(); // key -> {value, expiresAt|null}
const lists = new Map(); // key -> string[]
const sets = new Map(); // key -> Set<string>
const zsets = new Map(); // key -> Map<member, score>

const now = () => Date.now();

function alive(entry) {
  if (!entry) return false;
  if (entry.expiresAt !== null && entry.expiresAt <= now()) return false;
  return true;
}

function readLocal(key) {
  const entry = store.get(key);
  if (!alive(entry)) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

/** Reset every local structure. Test hook only; a no-op against Upstash. */
export function __resetLocalKv() {
  store.clear();
  lists.clear();
  sets.clear();
  zsets.clear();
}

function localCommand(args) {
  const [verb, ...rest] = args.map((value) => String(value));
  const name = verb.toUpperCase();

  switch (name) {
    case "GET":
      return readLocal(rest[0]);

    case "SET": {
      const [key, value, ...flags] = rest;
      const upper = flags.map((flag) => flag.toUpperCase());
      const existing = readLocal(key);

      if (upper.includes("NX") && existing !== null) return null;
      if (upper.includes("XX") && existing === null) return null;

      let expiresAt = null;
      const exIndex = upper.indexOf("EX");
      if (exIndex !== -1) {
        expiresAt = now() + Number(flags[exIndex + 1]) * 1000;
      } else if (upper.includes("KEEPTTL")) {
        const prior = store.get(key);
        expiresAt = alive(prior) ? prior.expiresAt : null;
      }
      store.set(key, { value, expiresAt });
      return "OK";
    }

    case "DEL": {
      let removed = 0;
      for (const key of rest) {
        if (readLocal(key) !== null) removed += 1;
        store.delete(key);
        if (lists.delete(key)) removed += 1;
        if (sets.delete(key)) removed += 1;
      }
      return removed;
    }

    case "EXISTS":
      return readLocal(rest[0]) !== null ? 1 : 0;

    case "EXPIRE": {
      const [key, seconds] = rest;
      const entry = store.get(key);
      if (!alive(entry)) return 0;
      entry.expiresAt = now() + Number(seconds) * 1000;
      return 1;
    }

    case "TTL": {
      const entry = store.get(rest[0]);
      if (!alive(entry)) return -2;
      if (entry.expiresAt === null) return -1;
      return Math.ceil((entry.expiresAt - now()) / 1000);
    }

    case "RPUSH": {
      const [key, ...values] = rest;
      const list = lists.get(key) ?? [];
      list.push(...values);
      lists.set(key, list);
      return list.length;
    }

    case "LPOP": {
      const list = lists.get(rest[0]);
      if (!list || list.length === 0) return null;
      return list.shift();
    }

    case "LLEN":
      return (lists.get(rest[0]) ?? []).length;

    case "SADD": {
      const [key, ...values] = rest;
      const set = sets.get(key) ?? new Set();
      let added = 0;
      for (const value of values) {
        if (!set.has(value)) added += 1;
        set.add(value);
      }
      sets.set(key, set);
      return added;
    }

    case "SREM": {
      const [key, ...values] = rest;
      const set = sets.get(key);
      if (!set) return 0;
      let removed = 0;
      for (const value of values) if (set.delete(value)) removed += 1;
      return removed;
    }

    case "SMEMBERS":
      return [...(sets.get(rest[0]) ?? [])];

    case "ZADD": {
      const [key, score, member] = rest;
      const zset = zsets.get(key) ?? new Map();
      const isNew = !zset.has(member);
      zset.set(member, Number(score));
      zsets.set(key, zset);
      return isNew ? 1 : 0;
    }

    case "ZREM": {
      const [key, ...members] = rest;
      const zset = zsets.get(key);
      if (!zset) return 0;
      let removed = 0;
      for (const member of members) if (zset.delete(member)) removed += 1;
      return removed;
    }

    /* Only the "0 .. max, LIMIT 0 n" form jobs.js issues is supported. */
    case "ZRANGEBYSCORE": {
      const [key, min, max, , offset, count] = rest;
      const zset = zsets.get(key);
      if (!zset) return [];
      const lower = min === "-inf" ? -Infinity : Number(min);
      const upper = max === "+inf" ? Infinity : Number(max);
      const matching = [...zset.entries()]
        .filter(([, score]) => score >= lower && score <= upper)
        .sort((a, b) => a[1] - b[1])
        .map(([member]) => member);
      if (count === undefined) return matching;
      const start = Number(offset) || 0;
      return matching.slice(start, start + Number(count));
    }

    case "ZCARD":
      return (zsets.get(rest[0]) ?? new Map()).size;

    /*
     * Only the two compare-and-set scripts jobs.js uses are recognised, matched
     * by shape rather than executed. Embedding a Lua interpreter to run two
     * four-line scripts would be a far larger risk than pattern-matching them,
     * and an unrecognised script throws rather than pretending to succeed.
     */
    case "EVAL": {
      const [script, , key, argument, seconds] = rest;
      const isRenew = script.includes("EXPIRE");
      const isRelease = script.includes("DEL");
      if (!isRenew && !isRelease) {
        throw new Error("Local KV: unrecognised Lua script.");
      }
      if (readLocal(key) !== argument) return 0;
      if (isRenew) return localCommand(["EXPIRE", key, seconds]);
      return localCommand(["DEL", key]);
    }

    default:
      throw new Error(`Local KV: unsupported command ${name}.`);
  }
}

/**
 * Run one Redis command against whichever backend this process uses.
 *
 * @param {(string|number)[]} args e.g. ["SET", key, value, "NX", "EX", "120"]
 */
export async function command(args) {
  if (usingLocalKv()) return localCommand(args);
  return upstashCommand(args);
}
