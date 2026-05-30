# Cursor Cloud Agents — GeoRoids

<!-- fleet-doc-version: 7 -->

This repo is configured for **cloud-only development**: agents, skills, and rules are self-contained in git (no developer-home agents checkout on the VM).

## Layout

```text
<repo>/
├── AGENTS.md                         # @.agents/AGENTS.md + ## Project / ## Purpose
├── .agents/                          # git subtree from dotagents (fleet branch)
│   ├── AGENTS.md                     # fleet persona + collaboration
│   ├── agents/                       # review-fix-push subagent prompts
│   ├── skills/                       # review-fix, review-fix-push
│   ├── hooks/
│   │   └── block-git-no-verify.sh    # fleet — blocks git push/commit --no-verify (Cursor hook)
│   ├── rules/                        # canonical guidelines (.md, Cursor frontmatter)
│   ├── FLEET.lock                    # pinned dotagents fleet branch SHA (written on sync in app repos)
│   └── scripts/
│       ├── link-fleet-rules.sh       # wire .agents/rules into .cursor/rules/
│       └── merge-cursor-git-guard.sh # merge git guard into .cursor/hooks.json
├── .cursor/
│   ├── environment.json              # cloud VM install (+ optional terminals)
│   ├── hooks.json                    # git guard (+ project hooks)
│   └── rules/                        # fleet symlinks (.mdc) + project-only rules
└── scripts/
    ├── update-agents-subtree.sh      # pull fleet updates from dotagents
    └── cloud-fleet-sync-if-stale.sh  # cloud task start — pull when FLEET.lock is behind
```

Cloud agents discover:

- **Skills** at `.agents/skills/`
- **Fleet persona** at `.agents/AGENTS.md` (included via root `AGENTS.md`)
- **Rules** at `.cursor/rules/` (fleet symlinks + project-only files)
- **Instructions** from root `AGENTS.md`

They **do** read the committed `.agents/` subtree in the repo. They do **not** see developer-home skill paths, `~/.cursor/skills/`, or machine-local symlinks outside the repo.

### Edit path (fleet changes)

Fleet changes go to [dotagents](https://github.com/jsolly/dotagents) `main` → CI publishes the `fleet` branch → each app repo syncs via **Fleet sync at cloud task start** (below) or `./scripts/update-agents-subtree.sh`. **Never edit `.agents/` in app repos** — the next fleet publish or subtree pull overwrites direct edits.

## Fleet sync at cloud task start (agent-run)

Cloud agents only see **committed** `.agents/` on the branch Cursor cloned. **At the start of each cloud task**, refresh fleet when `FLEET.lock` is behind `dotagents/fleet`.

1. **Secrets** — [Cloud Agents → Secrets](https://cursor.com/dashboard?tab=cloud-agents) for this repository:

   | Secret | Value |
   | --- | --- |
   | `DOTAGENTS_GITHUB_TOKEN` | Fine-grained PAT: **read-only** Contents on `jsolly/dotagents` (used by `update-agents-subtree.sh` to fetch `fleet`) |

   App-repo push uses Cursor’s normal GitHub access for this repository. Do **not** put `GH_AGENT_TOKEN` in repo secrets for fleet fetch — keep that in Cursor-only config.

2. **Working tree** — `update-agents-subtree.sh` requires a clean tree. Commit or stash unrelated work first.

3. **Check and pull** (from repo root):

   ```bash
   bash scripts/cloud-fleet-sync-if-stale.sh
   ```

   Compares `.agents/FLEET.lock` to `dotagents/fleet`; when stale, runs `./scripts/update-agents-subtree.sh` (subtree pull, `FLEET.lock`, rule links, git-guard merge).

4. **Commit and push** any changes before feature work:

   ```bash
   git status
   git add .agents .cursor/rules .cursor/hooks.json docs/cloud-agents.md
   git add .agents/FLEET.lock 2>/dev/null || true
   git commit -m "chore(fleet): sync agent fleet from dotagents"
   git push
   ```

   Stage only paths that changed. Skip the commit if `git status` is clean.

If `dotagents` remote is missing, `update-agents-subtree.sh` adds it.

## Environment

See `.cursor/environment.json`. Fleet repos use an `install` command (typically `bash scripts/cloud-agent-install.sh`) and **do not** commit a `"snapshot"` field — every agent boot runs install, then Cursor may reuse internal checkpoints (best-effort; see [Cloud Agent setup](https://cursor.com/docs/cloud-agent/setup)).

After install succeeds, run smoke checks from root `AGENTS.md` (e.g. `npm run check:ts`, `npm test`). Do **not** add `snapshot` or `agentCanUpdateSnapshot` to `environment.json` unless the user explicitly asks for snapshot pinning.

**Project-local paths (never overwritten by fleet subtree pull):** extra files under `.agents/hooks/` (e.g. deploy checks) and `.agents/automations/` — commit these in the child repo only. Fleet ships `block-git-no-verify.sh` and `merge-cursor-git-guard.sh` via subtree.

**Git guard hook:** `merge-cursor-git-guard.sh` wires `block-git-no-verify.sh` into `.cursor/hooks.json` (`beforeShellExecution`). Fleet sync is **not** a hook — use `cloud-fleet-sync-if-stale.sh` at task start.

## Fleet updates (dotagents subtree)

Fleet config is vendored from [dotagents](https://github.com/jsolly/dotagents) `fleet` branch via [git subtree](https://gist.github.com/SKempin/b7857a6ff6bddb05717cc17a44091202).

**Pull latest fleet into this repo:**

```bash
./scripts/update-agents-subtree.sh
```

Or from a cloud task: `bash scripts/cloud-fleet-sync-if-stale.sh` (checks `FLEET.lock` first).

**Edit fleet canonical copy** (in `~/.agents` / dotagents `main`):

```bash
cd ~/.agents
# edit agents/, skills/, rules/
git add -A && git commit -m "..." && git push   # CI rebuilds + publishes the fleet branch
```

Then sync into this repo via cloud task start or `update-agents-subtree.sh`.

**Note:** `.agents/` in this repo is **read-only** — pull-only. The `fleet` branch is published by dotagents CI from `~/.agents/`; editing `.agents/` here and pushing back upstream does not round-trip (the next CI publish overwrites it). Make fleet changes in `~/.agents/`.

### Secrets summary

| Secret | Where | Purpose |
| --- | --- | --- |
| `DOTAGENTS_GITHUB_TOKEN` | Cursor Cloud repo secrets | Cloud agent fetch of `jsolly/dotagents` `fleet` |
| `FLEET_SYNC_TOKEN` | GitHub Actions repo secret | PR workflow `fleet-lock-guard` when `.agents/` changes |

Do **not** reuse `GH_AGENT_TOKEN` for fleet fetch — broader cross-repo scope; keep in Cursor-only config.

### FLEET.lock on pull requests

Repos with `.github/workflows/fleet-lock-guard.yml` verify that `.agents/FLEET.lock` matches `dotagents/fleet` when `.agents/` changes in a PR.

## Project-only vs fleet

| Asset | Location | Synced from dotagents? |
| --- | --- | --- |
| Fleet persona, review skills, code-style rules | `.agents/` | Yes (subtree) |
| Project-only Cursor rules | `.cursor/rules/*.mdc` (real files) | No |
| Dev environment | `.cursor/environment.json` | No (per-repo) |
| Commands, architecture | `AGENTS.md` sections below `@.agents/` | No |

## References

- [Cursor Cloud Agent setup](https://cursor.com/docs/cloud-agent/setup)
- [Cursor Skills](https://cursor.com/docs/skills)
