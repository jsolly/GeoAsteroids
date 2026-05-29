# Cursor Cloud Agents

GeoAsteroids is configured for **cloud-only development**: agents, skills, and rules are self-contained in this repo.

## Layout

```text
GeoAsteroids/
├── AGENTS.md                         # @.agents/AGENTS.md + ## Project
├── .agents/                          # git subtree from dotagents (fleet branch)
│   ├── AGENTS.md                     # fleet persona + collaboration
│   ├── agents/                       # review-fix-push subagent prompts
│   ├── skills/                       # review-fix, review-fix-push
│   ├── rules/                        # canonical guideline markdown
│   └── .cursor/rules/                # Cursor auto-apply rules (.mdc symlinks)
├── .cursor/
│   ├── environment.json              # cloud VM install + dev terminals
│   └── rules/                        # fleet symlinks + project-only rules
└── scripts/
    ├── update-agents-subtree.sh      # pull fleet updates from dotagents
    └── link-fleet-rules.sh           # wire .agents rules into .cursor/rules/
```

Cloud agents discover:

- **Skills** at `.agents/skills/`
- **Rules** at `.cursor/rules/` (fleet + project)
- **Instructions** from root `AGENTS.md`

They do **not** see `~/.agents/`, `~/.cursor/skills/`, or local symlinks outside the repo.

## Environment

`.cursor/environment.json`:

```json
{
  "install": "npm ci || npm install && (test -f .env || cp .env.example .env)",
  "terminals": [
    { "name": "dev", "command": "npm run dev" }
  ]
}
```

On first boot, install copies `.env.example` → `.env` if needed. `scripts/dev-server.sh` does the same before starting `tsx --env-file=.env`.

The install step previously failed when `@biomejs/biome` pointed at an expired pkg.pr.new URL — now pinned to the npm registry.

**Dashboard:** If you set a custom update script in the [Cloud Agents dashboard](https://cursor.com/dashboard/cloud-agents#environments), match `npm ci || npm install` or defer to the repo file.

## Fleet updates (dotagents subtree)

Fleet config is vendored from [dotagents](https://github.com/jsolly/dotagents) `fleet` branch via [git subtree](https://gist.github.com/SKempin/b7857a6ff6bddb05717cc17a44091202).

**Pull latest fleet into this repo:**

```bash
./scripts/update-agents-subtree.sh
```

**Edit fleet canonical copy** (in `~/.agents/` on a machine that has it):

```bash
cd ~/.agents
# edit agents/, skills/, rules/
./scripts/refresh-fleet.sh
git add fleet/ && git commit -m "..."
./scripts/refresh-fleet.sh --push
```

Then in GeoAsteroids: `./scripts/update-agents-subtree.sh`

**Push repo edits back to dotagents** (e.g. improved a skill in cloud):

```bash
git subtree push --prefix=.agents dotagents fleet
```

Then merge `fleet` branch into `fleet/` on dotagents `main` (or re-run `refresh-fleet.sh` there to reconcile).

## Project-only vs fleet

| Asset | Location | Synced from dotagents? |
| --- | --- | --- |
| Fleet persona, review skills, code-style rules | `.agents/` | Yes (subtree) |
| Browser integration testing playbook | `.cursor/rules/browser-integration-testing.mdc` | No (project) |
| Log file paths | `.cursor/rules/log-files.mdc` | No (project) |
| Dev environment | `.cursor/environment.json` | No (project) |
| Game architecture, commands | `AGENTS.md` ## Project | No (project) |

## Debugging in cloud

1. Dev server starts via `terminals` in `environment.json` (or `npm run dev`)
2. Integration tests: `./scripts/test-runner.sh tests/integration/browser/...` (never raw `npx vitest`)
3. Logs: `logs/client.log`, `logs/server.log`
4. Debug flags: edit `src/constants/index.ts` (`LOGGING`, `DEBUG`)

See `.cursor/rules/browser-integration-testing.mdc` for the full playbook.

## References

- [Cursor Cloud Agent setup](https://cursor.com/docs/cloud-agent/setup)
- [Cursor Skills](https://cursor.com/docs/skills)
- [Git subtree basics (SKempin)](https://gist.github.com/SKempin/b7857a6ff6bddb05717cc17a44091202)
