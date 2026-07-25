// مخطط السفر — sync backend
// Cloudflare Worker + D1. Paste into the dashboard editor. Binding required: DB (D1)
//
// Routes:
//   GET  /:code   → plan JSON. Works with an edit code or a view code.
//                   View codes get {"_readonly":true} added.
//   PUT  /:code   → save. Rejected if :code is a view code.

const ALLOW = "*"; // e.g. "https://prod-anas.github.io"

const cors = {
  "Access-Control-Allow-Origin": ALLOW,
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const json = (body, status = 200) =>
  new Response(body, {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS plans (
     code TEXT PRIMARY KEY,
     data TEXT NOT NULL,
     updated INTEGER NOT NULL
   )`,
  `ALTER TABLE plans ADD COLUMN view_code TEXT`,
  `DROP INDEX IF EXISTS plans_view`,
  `CREATE UNIQUE INDEX IF NOT EXISTS plans_view_u ON plans (view_code)`,
];

let schemaReady = false;

// Creates the table / adds the view_code column the first time it's needed.
async function migrate(env) {
  for (const sql of SCHEMA) {
    try { await env.DB.prepare(sql).run(); }
    catch (e) { /* duplicate column is expected on later runs */ }
  }
}

async function ensureSchema(env) {
  if (schemaReady) return;
  await migrate(env);
  schemaReady = true;
}

async function guarded(env, run) {
  try {
    return await run();
  } catch (err) {
    if (!/no such (table|column)/i.test(String(err))) throw err;
    await migrate(env);
    return await run();
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const code = new URL(request.url).pathname.replace(/^\/+|\/+$/g, "").toUpperCase();
    if (!/^[A-Z0-9]{4,16}$/.test(code)) return json('{"error":"bad code"}', 400);

    try {
      await ensureSchema(env);

      if (request.method === "GET") {
        const own = await guarded(env, () =>
          env.DB.prepare("SELECT data FROM plans WHERE code = ?").bind(code).first()
        );
        if (own && own.data) return json(own.data);

        const shared = await guarded(env, () =>
          env.DB.prepare("SELECT data FROM plans WHERE view_code = ?").bind(code).first()
        );
        if (shared && shared.data) {
          let parsed;
          try { parsed = JSON.parse(shared.data); } catch (e) { parsed = { trips: [] }; }
          parsed._readonly = true;
          delete parsed.viewId; // don't leak the pair back out
          return json(JSON.stringify(parsed));
        }
        return json('{"trips":[]}');
      }

      if (request.method === "PUT") {
        const body = await request.text();
        if (body.length > 400000) return json('{"error":"too large"}', 413);

        let parsed;
        try {
          parsed = JSON.parse(body);
          if (!Array.isArray(parsed.trips)) throw new Error();
        } catch (e) {
          return json('{"error":"bad json"}', 400);
        }

        const isView = await guarded(env, () =>
          env.DB.prepare("SELECT code FROM plans WHERE view_code = ?").bind(code).first()
        );
        if (isView) return json('{"error":"read only link"}', 403);

        const viewId =
          typeof parsed.viewId === "string" && /^[A-Z0-9]{4,16}$/.test(parsed.viewId)
            ? parsed.viewId
            : null;

        // a view code must not collide with any edit code or another plan's view code
        if (viewId) {
          const clash = await guarded(env, () =>
            env.DB.prepare(
              "SELECT code FROM plans WHERE (code = ?1 OR view_code = ?1) AND code != ?2"
            ).bind(viewId, code).first()
          );
          if (clash) return json('{"error":"view id taken"}', 409);
        }

        // ?create=1 → refuse to touch an existing plan. The primary key decides,
        // so two devices generating the same code can never overwrite each other.
        const create = new URL(request.url).searchParams.get("create") === "1";
        if (create) {
          try {
            await guarded(env, () =>
              env.DB.prepare(
                "INSERT INTO plans (code, data, updated, view_code) VALUES (?1, ?2, ?3, ?4)"
              ).bind(code, body, Date.now(), viewId).run()
            );
          } catch (err) {
            if (/UNIQUE|constraint/i.test(String(err))) return json('{"error":"code taken"}', 409);
            throw err;
          }
          return json('{"ok":true,"created":true}');
        }

        await guarded(env, () =>
          env.DB.prepare(
            `INSERT INTO plans (code, data, updated, view_code) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(code) DO UPDATE SET data = ?2, updated = ?3, view_code = ?4`
          ).bind(code, body, Date.now(), viewId).run()
        );
        return json('{"ok":true}');
      }
    } catch (err) {
      return json(JSON.stringify({ error: String(err && err.message) }), 500);
    }

    return json('{"error":"method not allowed"}', 405);
  },
};
