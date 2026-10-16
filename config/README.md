# Configuration

Relocatable tracked settings have one repository-owned home under `config/<domain>/`:

- `app/astro.ts` and `app/svelte.js` own framework/build settings. Native
  `astro.config.ts` and `svelte.config.js` delegate. Astro's helper import is
  explicitly rebased; roots, proxy routes, asset retention and the native
  development restart target remain unchanged.
- `app/.env.example` is the non-secret development/benchmark template. Runners
  copy it to native `.env.local` only when that file is missing. Existing local
  environment settings, databases and platform secrets stay with their owners.
- `server/debug-reports.json` owns static debug-report routing. The server's import,
  release classifier and benchmark product fingerprint follow it; routing values
  and external services are unchanged.
- `typescript/` owns the project, build, frontend, benchmark, unused-code and
  strict configurations. Includes/files and inheritance paths are rebased.
  Native root `tsconfig*.json` adapters preserve tool discovery and commands.
- `testing/vitest.ts` owns projects, environment conditions, artifact-session
  cache selection, coverage and worker isolation. Native `vitest.config.ts`
  delegates; unit, component and integration discovery remain intact.
- `quality/biome.settings.jsonc` owns rules and root-scoped overrides. Native
  `biome.jsonc` extends it; the non-discovery filename avoids a nested project.
  The severity audit parses the owner and inventories the native root policy.
- `quality/prettier.json` owns Astro/Svelte plugins and formatting overrides.
  Native `prettier.config.js` imports it for ordinary CLI/editor discovery.
- `quality/knip.js` owns unused-code settings. Native `knip.config.js` delegates;
  framework analysis explicitly includes native entries and settings modules.
- `quality/yamllint.yaml` and `quality/.markdownlint-cli2.jsonc` are selected
  explicitly by the YAML command and root-anchored Markdown helper.

Required native exceptions remain: package manifests and lockfiles, `.npmrc`,
`.nvmrc`, `.mise.toml`, Git files, `.worktreeinclude`, `.github/`, native agent
registrations, `.repo-independent.json`, the delegation files above,
`components.json`, `.pages.yml`, `src/content.config.ts` and `vercel.json`.
The Railway infrastructure definition stays in `.railway/`; this migration
neither applies infrastructure nor changes production persistence or previews.
Executable helpers, gameplay/application data, Wiki provenance and media
baselines, fixtures, public assets and helper dependency manifests keep their owners.
Unused VS Code launch setup is retired; no VS Code wiring is required.

Release classification includes authoritative server/build settings, while
retaining native historical paths when inspecting older commit diffs. The server
module graph still rejects client imports. Wiki source review and benchmark
fingerprints include moved owners; old review batches remain historical evidence.
Configuration changes cannot bypass either contract or the four required CI lanes.

Create only used domains. Preserve effective roots, selected inputs, scopes,
imports, plugins, caches and outputs. Compare resolved TypeScript/Astro/Vitest and
native Prettier behavior; check actual Biome scope and Knip dependency discovery,
then run the full repository gate and CI. CI's linux-x64 Wiki media verification
remains required; a macOS baseline is never accepted in its place. No gameplay
rule, control or Wiki article behavior is changed by this relocation.

After merge, verify the intended Vercel production deployment, classify server
release inputs from the actual base/merge SHAs, verify any required Railway Git
release, and follow its exact-release production smoke. This does not authorize
an automatic Preview or a production infrastructure apply. No external checkout,
home links, shared runtime package, generator or automatic synchronization is needed.
