# مخطط السفر — trip planner

A single-file web app for two people to plan trips together. No build step, no npm, no credit card.

- `index.html` — the app (goes on GitHub Pages)
- `worker.js` — the sync backend (goes on Cloudflare)

## 1. Put the app on GitHub Pages

1. Create a public repository.
2. Upload `index.html` to the root.
3. **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save.**
4. A minute later it's live at `https://YOUR-USERNAME.github.io/YOUR-REPO/`

It works already, but each phone keeps its own copy. Step 2 connects them.

## 2. Set up syncing (Cloudflare, free, no card)

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) — the Workers free plan needs no payment details.
2. **Storage & Databases → KV → Create a namespace.** Name it `trips`.
3. **Compute (Workers) → Create → Start from Hello World → Deploy.** Name it `trip-sync`.
4. Open the worker → **Edit code**, delete what's there, paste all of `worker.js`, **Deploy**.
5. Worker → **Settings → Bindings → Add → KV namespace.**
   - Variable name: `TRIPS` (exactly this, capitals)
   - KV namespace: `trips`
   - Save, then **Deploy** once more.
6. Copy the worker URL from its overview page — `https://trip-sync.SOMETHING.workers.dev`
7. In `index.html`, near the top of the `<script>`, set:

   ```js
   const API = "https://trip-sync.SOMETHING.workers.dev";
   ```

8. Commit. Pages redeploys itself.

Test it: open the worker URL with `/TEST123` on the end in a browser. You should see `{"trips":[]}`.

## 3. Pair your two phones

1. Open the site, tap **إنشاء رمز جديد**. You get a 6-character code.
2. Send her the code. She opens the same URL and enters it under **أو أدخلا رمزاً موجوداً**.
3. Same plan on both phones. Changes appear within a few seconds.

The gear icon (⚙) shows your code again or switches to a different one.

On iPhone: open the URL in Safari → Share → **Add to Home Screen**.

## Free tier headroom

Cloudflare's free Workers plan gives 100,000 requests a day, and KV allows 100,000 reads and 1,000 writes a day with 1 GB of storage. The app polls every 6 seconds only while the page is open and visible, and writes are batched half a second after you stop typing. Two people will not come close to any of these.

## Security

There are no secrets in this setup — nothing to leak from the repo. The worker URL is public, and access is controlled by your 6-character code: about a billion combinations, so nobody will guess it. Don't post the code publicly.

Two optional hardening steps once it works:

- In `worker.js`, change `ALLOW` from `"*"` to your Pages origin (`https://YOUR-USERNAME.github.io`) so only your own site can call it.
- Use a longer code — the worker accepts anything from 4 to 12 characters, so you can invent your own instead of using the generated one.
