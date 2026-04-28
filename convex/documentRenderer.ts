/**
 * Lightweight handlebars-style template renderer for document_templates
 * (PRD §10.3). Supports the subset MWRD's templates need without pulling
 * in a full library:
 *
 *   - {{path.to.field}}              — interpolation with dotted paths
 *   - {{#if path}}...{{/if}}         — truthy conditional
 *   - {{#each path as |item|}}...{{/each}}   — array iteration
 *
 * The renderer is HTML-escaping by default. Use {{{path}}} (triple braces)
 * to mark a value as already-safe HTML and skip escaping — used sparingly
 * for things like the bilingual side-by-side wrapper.
 */

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const resolvePath = (ctx: any, path: string): unknown => {
  if (!path) return undefined;
  const parts = path.split(".");
  let cur: any = ctx;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
};

const stringify = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
};

/**
 * Render a single template body against a context. Pure function.
 */
export function renderTemplate(body: string, context: any): string {
  let out = body;

  // {{#each <path> as |item|}}...{{/each}} — non-nested for v1
  out = out.replace(
    /\{\{#each\s+([\w.]+)\s+as\s+\|(\w+)\|\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_match, path, varName, inner) => {
      const arr = resolvePath(context, path);
      if (!Array.isArray(arr)) return "";
      return arr
        .map((item) => renderTemplate(inner, { ...context, [varName]: item }))
        .join("");
    },
  );

  // {{#if <path>}}...{{/if}}
  out = out.replace(
    /\{\{#if\s+([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, path, inner) => {
      const v = resolvePath(context, path);
      const truthy = Array.isArray(v) ? v.length > 0 : Boolean(v);
      return truthy ? renderTemplate(inner, context) : "";
    },
  );

  // {{{path}}} — unescaped (rare; use only for trusted HTML fragments)
  out = out.replace(/\{\{\{([\w.]+)\}\}\}/g, (_match, path) =>
    stringify(resolvePath(context, path)),
  );

  // {{path}} — escaped
  out = out.replace(/\{\{([\w.]+)\}\}/g, (_match, path) =>
    escapeHtml(stringify(resolvePath(context, path))),
  );

  return out;
}

/**
 * Wrap two rendered bodies into a side-by-side bilingual layout. The AR
 * column is `dir="rtl"`; the EN column is left default. Both share the
 * same outer page wrapper for printability.
 */
export function bilingualWrapper(args: {
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
}): string {
  const styles = `
    body { font-family: -apple-system, system-ui, "IBM Plex Sans", "Tajawal", "Noto Sans Arabic", sans-serif; margin: 0; padding: 24px; background: #f5f5f0; color: #1a1a1a; }
    .doc { max-width: 1100px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
    .doc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .col { padding: 16px; border: 1px solid #ece7e1; border-radius: 8px; }
    .col h1, .col h2, .col h3 { margin-top: 0; }
    .col[dir="rtl"] { text-align: right; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { padding: 8px 12px; border-bottom: 1px solid #ece7e1; text-align: start; }
    th { background: #faf8f5; font-weight: 600; }
    .meta { color: #5f625f; font-size: 12px; }
    .total-row { font-weight: 700; }
    .signature-block { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 16px; }
    .signature { flex: 1 1 180px; padding: 12px; border: 1px dashed #cfcfc8; border-radius: 6px; min-width: 160px; }
    .signature-label { margin: 0 0 6px; font-size: 12px; font-weight: 600; color: #3a3a3a; }
    .signature img { max-height: 60px; max-width: 100%; display: block; margin: 4px 0; }
    .stamp-block { margin-top: 24px; text-align: end; }
    .stamp { max-height: 120px; max-width: 200px; opacity: 0.95; }
    @media print { body { background: #fff; padding: 0; } .doc { box-shadow: none; padding: 0; } }
  `;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>${escapeHtml(args.titleEn)}</title><style>${styles}</style></head>
<body>
<div class="doc">
  <div class="doc-grid">
    <div class="col" dir="rtl"><h1>${escapeHtml(args.titleAr)}</h1>${args.bodyAr}</div>
    <div class="col" dir="ltr"><h1>${escapeHtml(args.titleEn)}</h1>${args.bodyEn}</div>
  </div>
</div>
</body></html>`;
}

export function singleLanguageWrapper(args: {
  title: string;
  body: string;
  dir: "ltr" | "rtl";
}): string {
  const styles = `
    body { font-family: -apple-system, system-ui, "IBM Plex Sans", "Tajawal", "Noto Sans Arabic", sans-serif; margin: 0; padding: 24px; background: #f5f5f0; color: #1a1a1a; }
    .doc { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { padding: 8px 12px; border-bottom: 1px solid #ece7e1; text-align: start; }
    th { background: #faf8f5; font-weight: 600; }
    .meta { color: #5f625f; font-size: 12px; }
    .total-row { font-weight: 700; }
    .signature-block { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 16px; }
    .signature { flex: 1 1 180px; padding: 12px; border: 1px dashed #cfcfc8; border-radius: 6px; min-width: 160px; }
    .signature-label { margin: 0 0 6px; font-size: 12px; font-weight: 600; color: #3a3a3a; }
    .signature img { max-height: 60px; max-width: 100%; display: block; margin: 4px 0; }
    .stamp-block { margin-top: 24px; text-align: end; }
    .stamp { max-height: 120px; max-width: 200px; opacity: 0.95; }
    @media print { body { background: #fff; padding: 0; } .doc { box-shadow: none; padding: 0; } }
  `;
  return `<!DOCTYPE html>
<html lang="${args.dir === "rtl" ? "ar" : "en"}" dir="${args.dir}">
<head><meta charset="utf-8" /><title>${escapeHtml(args.title)}</title><style>${styles}</style></head>
<body>
<div class="doc"><h1>${escapeHtml(args.title)}</h1>${args.body}</div>
</body></html>`;
}

/**
 * Compute SHA-256 of a string. Convex V8 runtime exposes Web Crypto via
 * `crypto.subtle`. Returns a lowercase hex digest.
 */
export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
