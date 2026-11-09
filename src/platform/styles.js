import { ACCENT } from "../palette.js";
import { FONT_FAMILY } from "../fonts.js";

export const CSS = `
:root{--ink:#020814;--muted:#5b6472;--line:#e3e0da;--panel:#fff;--bg:#f5f4f1;--accent:${ACCENT.ink};--accent-deep:${ACCENT.deep};--danger:#b3261e;--ok:#1d6b43;--warn:#8a5a00;--info:#22507a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:${FONT_FAMILY};font-size:15px;line-height:1.5}
a{color:var(--accent)}
button,input,select,textarea{font:inherit;color:inherit}
.pm-shell{display:grid;grid-template-columns:240px 1fr;min-height:100svh}
.pm-side{background:#0b1220;color:#d8dde6;padding:20px 14px;display:flex;flex-direction:column;gap:4px;position:sticky;top:0;height:100svh}
.pm-brand{font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:12px;color:#fff;padding:4px 10px 18px}
.pm-nav{display:flex;flex-direction:column;gap:2px}
.pm-nav a,.pm-nav span{display:flex;justify-content:space-between;align-items:center;padding:9px 10px;border-radius:6px;text-decoration:none;color:#c3cad6;font-size:14px;cursor:pointer}
.pm-nav a:hover{background:#17203a;color:#fff}
.pm-nav a[aria-current=page]{background:#fff;color:var(--ink);font-weight:600}
.pm-nav span{opacity:.45;cursor:default}
.pm-nav small{font-size:10px;text-transform:uppercase;letter-spacing:.08em}
.pm-side-foot{margin-top:auto;padding:10px;font-size:13px;color:#98a2b3;border-top:1px solid #1f2a44}
.pm-side-foot button{background:none;border:0;color:#d8dde6;padding:0;text-decoration:underline;cursor:pointer}
.pm-main{padding:28px clamp(16px,4vw,44px) 64px;max-width:1180px;width:100%}
.pm-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:22px}
h1{font-size:26px;margin:0 0 4px;letter-spacing:-.01em}
h2{font-size:17px;margin:0 0 12px}
.pm-sub{color:var(--muted);margin:0}
.pm-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:20px;margin-bottom:18px}
.pm-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-bottom:18px}
.pm-stat{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px}
.pm-stat b{display:block;font-size:28px;line-height:1.1}
.pm-stat span{color:var(--muted);font-size:13px}
.pm-btn{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 18px;border-radius:8px;border:1px solid var(--line);background:#fff;cursor:pointer;text-decoration:none;color:var(--ink);font-weight:600;font-size:14px}
.pm-btn:hover{border-color:#bdb8ae}
.pm-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.pm-btn.primary:hover{background:var(--accent-deep)}
.pm-btn.big{min-height:46px;padding:0 24px;font-size:15px}
.pm-btn[disabled]{opacity:.5;cursor:not-allowed}
.pm-btn.link{border:0;background:none;padding:0;min-height:0;color:var(--accent);text-decoration:underline;font-weight:500}
.pm-field{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}
.pm-field label,.pm-label{font-size:13px;font-weight:600}
.pm-field input,.pm-field select,.pm-field textarea{border:1px solid #cfcac1;border-radius:8px;padding:10px 12px;background:#fff;min-height:42px}
.pm-field input:focus,.pm-field select:focus{outline:2px solid var(--accent);outline-offset:1px}
.pm-hint{font-size:12.5px;color:var(--muted)}
.pm-row{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.pm-badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;background:#ece9e2;color:#3f4652;white-space:nowrap}
.pm-badge.queued,.pm-badge.processing{background:#e3eefa;color:var(--info)}
.pm-badge.proof_ready{background:#dff2e7;color:var(--ok)}
.pm-badge.failed{background:#fbe4e1;color:var(--danger)}
.pm-badge.uploaded{background:#f6ecd5;color:var(--warn)}
table.pm-table{width:100%;border-collapse:collapse;font-size:14px}
.pm-table th{text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);padding:8px 10px;border-bottom:1px solid var(--line)}
.pm-table td{padding:11px 10px;border-bottom:1px solid #efece6;vertical-align:middle}
.pm-table tr:last-child td{border-bottom:0}
.pm-scroll{overflow-x:auto}
.pm-alert{padding:12px 14px;border-radius:8px;margin-bottom:16px;font-size:14px;border:1px solid}
.pm-alert.error{background:#fdf0ee;border-color:#f0c4be;color:#7d1d16}
.pm-alert.ok{background:#e9f6ee;border-color:#bfe2cd;color:#14502f}
.pm-alert.warn{background:#fff6e0;border-color:#efd9a2;color:#6c4700}
.pm-alert.info{background:#eaf2fa;border-color:#c3d7ea;color:#1b4163}
.pm-steps{display:flex;gap:6px;margin:0 0 20px;padding:0;list-style:none;flex-wrap:wrap}
.pm-steps li{flex:1;min-width:110px;padding:8px 10px;border-radius:6px;background:#ece9e2;font-size:13px;color:var(--muted)}
.pm-steps li.done{background:#dff2e7;color:var(--ok)}
.pm-steps li.now{background:var(--accent);color:#fff;font-weight:600}
.pm-bar{height:8px;background:#ece9e2;border-radius:99px;overflow:hidden}
.pm-bar i{display:block;height:100%;background:var(--accent);transition:width .4s}
.pm-swatches{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}
.pm-swatch{display:flex;gap:10px;align-items:center;border:1px solid var(--line);border-radius:8px;padding:8px}
.pm-swatch input[type=color]{width:44px;height:44px;border:0;padding:0;background:none;cursor:pointer}
.pm-swatch code{font-size:12px;color:var(--muted)}
.pm-drop{border:2px dashed #cfcac1;border-radius:10px;padding:26px;text-align:center;background:#fbfaf8}
.pm-tpl{display:grid;grid-template-columns:150px 1fr;gap:18px}
.pm-tpl img{width:100%;border:1px solid var(--line);border-radius:6px;background:#fff}
.pm-auth{min-height:100svh;display:flex;align-items:center;justify-content:center;padding:24px}
.pm-auth .pm-card{width:100%;max-width:440px;padding:30px}
.pm-timeline{list-style:none;margin:0;padding:0}
.pm-timeline li{padding:8px 0 8px 16px;border-left:2px solid var(--line);font-size:14px}
.pm-timeline time{display:block;font-size:12px;color:var(--muted)}
.pm-empty{text-align:center;padding:36px 12px;color:var(--muted)}
.pm-badge.revision_requested{background:#f6ecd5;color:var(--warn)}
.pm-badge.completed,.pm-badge.approved{background:#dff2e7;color:var(--ok)}
.pm-viewer{border:1px solid var(--line);border-radius:8px;background:#e9e7e2;overflow:auto;max-height:78vh}
.pm-viewer-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
.ip-pdf-bar{display:none}
.ip-pdf-pages{display:flex;flex-direction:column;gap:12px;padding:12px;align-items:stretch}
.ip-pdf-page{margin:0;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.2);width:100%}
.ip-pdf-page canvas{width:100%;height:100%;display:block}
.ip-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.ip-note{padding:16px}.ip-muted{color:var(--muted)}
@media (max-width:860px){
  .pm-shell{grid-template-columns:1fr}
  .pm-side{position:static;height:auto;flex-direction:row;flex-wrap:wrap;align-items:center;padding:10px}
  .pm-brand{padding:4px 8px}.pm-side-foot{margin:0 0 0 auto;border:0;padding:4px 8px}
  .pm-nav{flex-direction:row;flex-wrap:wrap;width:100%;order:3}
  .pm-tpl{grid-template-columns:1fr}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;
