# Cursor Cloud Agents — Environment & Skills

This doc covers how GeoAsteroids is configured for Cursor Cloud Agents, including the environment update script and project skills.

## Environment update script

### Problem

Cloud agent VMs run an **install/update script** on boot (configured in `.cursor/environment.json` or the [Cloud Agents dashboard](https://cursor.com/dashboard/cloud-agents#environments)). If that script fails, you see:

> Update script failed. Your environment may not work as expected. Check your update script in your environment setup and fix any issues.

For this repo, the failure was:

```text
npm error 404 Not Found - GET https://pkg.pr.new/@biomejs/biome@7248dda
```

`package.json` had pinned `@biomejs/biome` to a temporary **pkg.pr.new** preview URL that expired. Fresh cloud VMs could not run `npm install`.

### Fix (merged to main)

1. Pin `@biomejs/biome` to `^2.4.16` from the npm registry (not pkg.pr.new).
2. Regenerate `package-lock.json` so `npm ci` works.
3. Add `.cursor/environment.json`:

   ```json
   {
     "install": "npm ci || npm install"
   }
   ```

4. Allow `.cursor/environment.json` through `.gitignore` (other `.cursor/*` stays local).

### Verify locally

```bash
npm ci
# or
npm install
```

Both should complete without 404 errors.

### Dashboard setup

If your Cloud Agents environment has a custom **update/install** command in the dashboard, either:

- Remove it and let the repo’s `.cursor/environment.json` take effect, or
- Set it to match: `npm ci || npm install`

After changing config, re-run environment setup or start a new cloud agent on an updated branch.

---

## Adding skills for cloud agents

Cloud agents clone your repo into an isolated VM. **Skills must live in the repo** — they do not see your local `~/.cursor/skills/` or `~/.agents/skills/`.

### Where to put skills

| Path | Scope |
|------|--------|
| `.cursor/skills/` | Project (recommended) |
| `.agents/skills/` | Project |
| `.claude/skills/`, `.codex/skills/` | Compatibility aliases |

Example layout:

```text
.cursor/skills/
└── debug-browser-tests/
    └── SKILL.md
```

### SKILL.md format

```markdown
---
name: debug-browser-tests
description: How to run and debug browser integration tests for GeoAsteroids.
---

# Debug Browser Tests

## When to Use
- When browser integration tests fail or hang
- When debugging laser, collision, or roid scenarios

## Instructions
- Always use `./scripts/test-runner.sh` (never raw `npx vitest` for integration tests)
- Check `logs/client.log` and `logs/server.log`
- See `.cursor/rules/browser-integration-testing.mdc` for the full playbook
```

Required frontmatter: `name` (matches folder name), `description`.

Optional: `paths` (glob to scope when skill applies), `disable-model-invocation: true` (slash-command only).

### Pair with AGENTS.md

Cloud agents read `AGENTS.md` at repo root. Keep run/test/debug commands there; use skills for deeper, on-demand workflows (e.g. “how to debug service X”).

See also: [Cursor Cloud Agent setup](https://cursor.com/docs/cloud-agent/setup), [Skills docs](https://cursor.com/docs/skills).

---

## Boot sequence (reference)

1. Start from base image, snapshot, or Dockerfile
2. Run **`install`** from `.cursor/environment.json` (update script)
3. Run optional **`start`** and **`terminals`** (e.g. dev server)
4. Clone/checkout repo at commit
5. Load `AGENTS.md` + `.cursor/skills/`

Keep `install` idempotent and fast (dependency sync only). Put heavy or one-off setup in `AGENTS.md` or skills.
