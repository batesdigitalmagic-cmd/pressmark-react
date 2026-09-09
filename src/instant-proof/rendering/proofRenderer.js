/*
 * Pressmark Instant Proof — rendering service interface.
 *
 * The UI talks to a *renderer*, never to a rendering implementation. Phase 1
 * ships MockProofRenderer, which fabricates a plausible result in the browser.
 * Phase 2 replaces it with a renderer that posts to our own API, which in turn
 * drives Adobe's InDesign APIs. Neither swap should require touching a
 * component — that is the entire point of this file.
 *
 * ── The contract ──
 *
 *   createProofJob(project)           -> Promise<ProofJob>
 *   uploadProofAssets(jobId, assets, onProgress) -> Promise<{uploaded:number}>
 *   startProofRender(jobId)           -> Promise<void>
 *   getProofStatus(jobId)             -> Promise<ProofJobStatus>
 *   getProofResult(jobId)             -> Promise<ProofResult>
 *   cancelProofJob(jobId)             -> Promise<void>
 *   isSimulated                       -> boolean
 *
 * Every method is async and every method may reject. The status object is the
 * only channel for progress, so a polling implementation and a streaming one
 * present identically to the UI.
 *
 * ── Why polling rather than callbacks ──
 *
 * A real InDesign render is a background job measured in tens of seconds. The
 * browser cannot hold a socket open for it reliably, and Vercel functions are
 * short-lived. getProofStatus() is therefore the primitive; the mock honours
 * the same shape so the component that drives it never learns the difference.
 *
 * @typedef {import('../models.js').ProofProject}   ProofProject
 * @typedef {import('../models.js').ProofJob}       ProofJob
 * @typedef {import('../models.js').ProofJobStatus} ProofJobStatus
 * @typedef {import('../models.js').ProofResult}    ProofResult
 * @typedef {import('../models.js').UploadedAsset}  UploadedAsset
 */

/**
 * @typedef {object} ProofRenderer
 * @property {boolean} isSimulated
 * @property {(project: ProofProject) => Promise<ProofJob>} createProofJob
 * @property {(jobId: string, assets: UploadedAsset[], onProgress?: (fraction: number) => void) => Promise<{uploaded: number}>} uploadProofAssets
 * @property {(jobId: string) => Promise<void>} startProofRender
 * @property {(jobId: string) => Promise<ProofJobStatus>} getProofStatus
 * @property {(jobId: string) => Promise<ProofResult>} getProofResult
 * @property {(jobId: string) => Promise<void>} cancelProofJob
 */

import { createMockProofRenderer } from "./mockProofRenderer.js";

/*
 * Selects the renderer for this build.
 *
 * PHASE 2: when the render API exists, this becomes
 *
 *   return import.meta.env.VITE_PROOF_RENDERER === "live"
 *     ? createHttpProofRenderer({ baseUrl: "/api/proof" })
 *     : createMockProofRenderer();
 *
 * Note the env var is a *feature flag*, not a credential — Adobe and storage
 * credentials stay server-side in the API routes, because Vite inlines
 * anything src/ reads straight into the browser bundle. eslint.config.js
 * enforces the matching rule that src/ may never import lib/ or api/.
 *
 * @returns {ProofRenderer}
 */
export function getProofRenderer() {
  return createMockProofRenderer();
}
