# Deploying Numera to Vercel

The live game is a static site. Vercel builds it from these three files:

- `build-vercel.js` — downloads the repo tarball from GitHub at `NUMERA_REF`
  (default: the `claude/math-learning-game-cbmo8j` branch) and stages the
  runtime files into `out/`. Nothing else is uploaded, so the 8 MB character
  model rides along without bloating the deploy payload.
- `package.json` — `npm run build` runs the script above.
- `vercel.json` — output directory, no install step, cache headers.

## Redeploy after a push

Either ask Claude to redeploy (it uploads these three files with
`deploy_to_vercel`), or in the Vercel dashboard open the **numera** project →
Deployments → **Redeploy**. The build re-fetches the branch head each time.

## Or connect Git once and forget about it

Vercel dashboard → Add New → Project → Import `rbreau/test`. Set:

- Framework preset: **Other**
- Root directory: `deploy/vercel`
- Build command: `node build-vercel.js` · Output directory: `out`
- Environment variable `NUMERA_REF` = the branch you want to publish

Every push to that branch then deploys automatically.

## Cloud saves

`index.html` carries the Supabase project URL and **publishable** key
(safe to ship: it can only call the two `get_save` / `put_save` functions).
The table itself is locked behind row-level security with no policies, so
the only way in is through those functions, which hash the player's link
code server-side.
