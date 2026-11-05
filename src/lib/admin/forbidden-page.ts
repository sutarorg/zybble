/**
 * The 403 body served by the proxy.
 *
 * The status code has to be a real 403, and the only place a Next.js app can
 * set an arbitrary status for a page request is the proxy — a Server Component
 * that renders a "denied" panel still answers 200. So the proxy returns this
 * document directly, and the page tree never runs for a non-admin.
 *
 * It is intentionally self-contained: no framework, no client JavaScript, no
 * reference to anything the visitor is not allowed to know exists. It is also
 * deliberately generic — it must not confirm whether `/admin` holds data,
 * which is why it reads as an ordinary 403 rather than "you are not an admin".
 */

import { NextResponse } from "next/server";

const HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>403 · Access denied · Zybble</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: #ffffff;
        color: #0f172a;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
          "Helvetica Neue", Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      main { max-width: 420px; text-align: center; }
      .mark {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.01em;
        color: #0f172a;
      }
      .mark span {
        display: inline-flex;
        width: 22px;
        height: 22px;
        border-radius: 6px;
        background: #2563eb;
        color: #fff;
        font-size: 13px;
        align-items: center;
        justify-content: center;
      }
      .code {
        margin: 40px 0 0;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #2563eb;
      }
      h1 {
        margin: 8px 0 0;
        font-size: 26px;
        line-height: 1.2;
        font-weight: 600;
        letter-spacing: -0.02em;
      }
      p {
        margin: 12px 0 0;
        font-size: 14px;
        line-height: 1.6;
        color: #64748b;
      }
      a {
        display: inline-block;
        margin-top: 28px;
        padding: 9px 16px;
        border-radius: 8px;
        background: #2563eb;
        color: #fff;
        font-size: 14px;
        font-weight: 500;
        text-decoration: none;
      }
      a:hover { background: #1d4ed8; }
    </style>
  </head>
  <body>
    <main>
      <div class="mark"><span>Z</span> Zybble</div>
      <p class="code">403</p>
      <h1>Access denied</h1>
      <p>
        You are signed in, but this area is restricted to platform
        administrators. If you believe this is a mistake, contact the site
        owner.
      </p>
      <a href="/dashboard">Back to your workspace</a>
    </main>
  </body>
</html>
`;

/** A complete 403 document, with no cache and no indexing. */
export function forbiddenResponse(): NextResponse {
  return new NextResponse(HTML, {
    status: 403,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, must-revalidate",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
