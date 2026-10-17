# Configuration

Relocatable tracked settings have one repository-owned home under `config/<domain>/`.

- `app/astro.ts` and `app/svelte.js` own framework/build settings. Package,
  development, integration and benchmark commands select the owners explicitly.
  Astro and Vitest select the same Svelte configuration by an absolute module-relative
  path. Astro's watch registration reloads its full container when the config changes
  or the Wiki refresh watcher signals that owner.
- `app/.env.example` is the non-secret development/benchmark template. Runners
  create native `.env.local` only when missing. Existing local environment settings,
  databases and platform secrets stay with their owners.
- `server/debug-reports.json` owns debug-report routing. Server imports, release
  classification and benchmark product fingerprints follow that owner.
- `typescript/` owns project, build, frontend, benchmark, unused-code and strict
  policy. Build and benchmark commands select their canonical files directly.
  Native `tsconfig.json` remains for Astro, TSX and the server release graph.
  Native `tsconfig.frontend.json` preserves the pinned Svelte checker's selected-config
  directory scope. Both are minimal inheritance adapters with no duplicate settings.
- `testing/vitest.ts` owns the existing projects, roots, conditions, per-session
  caches, coverage and worker isolation. Package and integration runners select it.
- `quality/biome.settings.jsonc` owns the full root-scoped Biome policy. CLI checks,
  the severity inventory and atomic Wiki review formatting select that same file.
- `quality/prettier.json` owns Astro/Svelte plugins and basename formatting
  overrides. The formatting command selects it explicitly. `quality/knip.js`
  selects the actual framework/testing/quality owners and retains Svelte's Vite globs.
- `quality/yamllint.yaml` and `quality/.markdownlint-cli2.jsonc` are selected by
  the existing YAML command and root-anchored Markdown helper.
- `agents/repository.json` owns hook identity and the trusted file inventory.
  The authenticated upgrade procedure is in [development](../docs/development.md#hook-trust).

Required native exceptions remain: package manifests and lockfiles, `.npmrc`,
`.nvmrc`, `.mise.toml`, Git files, `.worktreeinclude`, `.github/`, native agent
registrations, the two TypeScript adapters above, `components.json`, `.pages.yml`,
`src/content.config.ts` and `vercel.json`. Each has an active native consumer.
Railway infrastructure definitions stay in `.railway/`. Application/setup code,
executable helpers, gameplay data, Wiki provenance/media, fixtures and public
assets retain their owners. No VS Code setup or editor extension is required.

The unused-export helper creates actual default-export consumers in its existing
disposable frontend entry. Canonical Astro/Vitest modules remain analyzed;
arbitrary named exports are never exempted by listing entire modules in `files`.
Generic inherited tool entries keep their existing contract.

Historical root paths remain in the server release classifier when old commit
diffs require them. Current benchmark and Wiki inventories use the actual owners;
older review batches and benchmark measurements remain historical evidence.
Configuration moves cannot bypass source review, the server/client import boundary,
the complete local gate or any of the four required CI lanes. The Wiki media lane
must pass on linux-x64; a macOS run cannot replace it.

Compare effective roots, inputs, formatting, plugins, test scopes and actual build
artifacts before merging. Verify the intended Vercel release, classify server inputs
from the actual base/merge SHAs, verify any required Railway Git release, then follow
the exact-release production smoke. This authorizes no Preview, unrelated staged
Railway patch or infrastructure apply. No private checkout, home link, shared runtime,
generator or automatic synchronization is required.
