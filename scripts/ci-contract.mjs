import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { parse } from 'yaml';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const ci = parse(read('.github/workflows/ci.yml'));
const coverage = parse(read('.github/workflows/coverage.yml'));
const required = ci.jobs.ci;
assert.deepEqual(required.needs, [
  'static-checks',
  'runner-contracts',
  'integration-tests',
  'wiki-media',
]);
// The required check runs whenever its lanes run, keeps the deferred name otherwise, and fails
// when any of its steps fails.
assert.equal(required.if, `always() && (${ci.jobs['static-checks'].if})`);
assert.equal(required.name, ci.jobs['static-checks'].name.replaceAll('static-checks', 'ci'));
assert.equal(required['continue-on-error'], undefined, 'ci must fail when it fails');
assert.deepEqual(
  required.steps
    .filter((step) => step['continue-on-error'] !== undefined || step.if !== undefined)
    .map((step) => step.name ?? step.uses),
  []
);
for (const name of required.needs) {
  assert.equal(
    ci.jobs[name].needs,
    undefined,
    `${name} must start without waiting for another lane`
  );
  assert.ok(ci.jobs[name]['timeout-minutes'] <= 4);
  // The committed Wiki media baseline belongs to linux-x64; every other lane runs on arm64.
  assert.equal(
    ci.jobs[name]['runs-on'],
    name === 'wiki-media' ? 'ubuntu-24.04' : 'ubuntu-24.04-arm'
  );
  assert.equal(ci.jobs[name].if, ci.jobs['static-checks'].if);
  assert.equal(ci.jobs[name].name, ci.jobs['static-checks'].name.replaceAll('static-checks', name));
  // Only the reusable-tree lookup may fail without failing its lane.
  assert.equal(ci.jobs[name]['continue-on-error'], undefined, `${name} must fail when it fails`);
  assert.deepEqual(
    ci.jobs[name].steps
      .filter((step) => step['continue-on-error'] !== undefined)
      .map((step) => step.id),
    ['verified-tree']
  );
}
// Secrets scan precedes reusable-tree decisions in each independently validated lane.
for (const name of required.needs) {
  const steps = ci.jobs[name].steps;
  assert.equal(steps[0].uses, 'actions/checkout@v7');
  assert.equal(steps[0].with['fetch-depth'], 0);
  assert.equal(steps[0].with['persist-credentials'], false);
  assert.equal(steps[1].name, 'Secrets scan (range)');
  assert.equal(steps[1].if, undefined);
  assert.match(steps[1].run, /sha256sum --check/u);
  assert.match(steps[1].run, /--text/u);
  assert.match(steps[1].run, /--diff-merges=remerge/u);
  assert.equal(steps[1].run, ci.jobs['static-checks'].steps[1].run);
  assert.equal(steps[2].id, 'verified-tree');
  assert.equal(steps[2].run, 'bash scripts/ci-verified-tree.sh');
  const proof = steps.find((step) => step.name === 'Record validated PR tree');
  assert.ok(proof);
  assert.equal(
    proof.with.name,
    `ci-tree-v1-\${{ github.job }}-\${{ steps.verified-tree.outputs.tree }}-\${{ github.run_attempt }}`
  );
  assert.equal(proof.with.path, `\${{ runner.temp }}/ci-tree-\${{ github.job }}.txt`);
  assert.match(proof.if, /success\(\)/u);
}
assert.deepEqual(Object.keys(coverage.on), ['workflow_dispatch']);
assert.equal(
  JSON.parse(read('package.json')).scripts.gate,
  'FLEET_DOC_FAST=0 bash .git-hooks/pre-commit'
);
const hook = read('.git-hooks/pre-commit');
assert.match(hook, /^node scripts\/gate\.mjs$/mu);
assert.doesNotMatch(hook, /run_step\s+"complete gate"/u);
assert.doesNotMatch(read('scripts/gate.mjs'), /pre-commit|npm.*gate/u);
assert.equal(
  JSON.parse(read('package.json')).scripts['test:review'],
  'bash scripts/test-review.sh'
);

// The lanes' scan is the canonical `ci` step plus an x64 archive for the media lane: the same
// release, arm64 pin and range logic, so a canonical bump cannot leave the lanes behind.
const laneScan = ci.jobs['static-checks'].steps[1].run;
const armPin = laneScan.match(
  /^ {2}ARM64\) gitleaks_arch=arm64 gitleaks_sha256=([0-9a-f]{64}) ;;$/mu
)?.[1];
assert.ok(armPin, 'lane scan must pin the arm64 gitleaks archive');
assert.match(laneScan, /^ {2}X64\) gitleaks_arch=x64 gitleaks_sha256=[0-9a-f]{64} ;;$/mu);
assert.equal(
  laneScan
    .replace(/^case "\$RUNNER_ARCH" in\n[\s\S]*?^esac\n/mu, '')
    .replace(/"(https:\S+)_\$\{gitleaks_arch\}\.tar\.gz"/u, '$1_arm64.tar.gz')
    .replace('$gitleaks_sha256', armPin),
  required.steps.find((step) => step.name === 'Secrets scan (range)').run
);

// Moving a check between lanes must neither remove nor duplicate a validation.
const originalStaticCommands = [
  'npm run check:actions',
  'npm run check:lint-policy',
  'npm run check:lint',
  'npm run check:knip',
  'npm run check:ts-prune',
  'npm run check:md',
  'npm run check:yaml',
  'npm run check:ts',
  'npm run check:frontend',
  'npm run check:format',
  'npm run check:benchmarks',
  'npm run check:test-runner',
  'npm run check:dev-server',
  'npm run build',
];
const commands = ['static-checks', 'runner-contracts'].flatMap((name) =>
  ci.jobs[name].steps.filter((step) => /^npm run /u.test(step.run ?? '')).map((step) => step.run)
);
assert.deepEqual([...commands].sort(), [...originalStaticCommands].sort());
assert.equal(new Set(commands).size, originalStaticCommands.length);
assert.deepEqual(
  ci.jobs['static-checks'].steps
    .filter((step) => /^npm run /u.test(step.run ?? ''))
    .map((step) => step.run),
  originalStaticCommands.filter(
    (command) => !['npm run check:test-runner', 'npm run check:dev-server'].includes(command)
  )
);
assert.deepEqual(
  ci.jobs['runner-contracts'].steps
    .filter((step) => /^npm run /u.test(step.run ?? ''))
    .map((step) => step.run),
  ['npm run check:test-runner', 'npm run check:dev-server']
);

// The replacement lane executes the complete default code inventory and binds
// retained reports to its source/runtime/cleanup receipt before it can pass.
const integrationSteps = ci.jobs['integration-tests'].steps;
const integration = integrationSteps.find(
  (step) => step.name === 'Run complete code integration inventory'
);
assert.ok(integration);
assert.equal(integration.if, "steps.verified-tree.outputs.run_full != 'false'");
assert.equal(
  integration.env.GEOROIDS_CODE_INTEGRATION_RECEIPT,
  `\${{ github.workspace }}/.performance/ci-code-integration/runner.json`
);
assert.match(
  integration.run,
  /GEOROIDS_TEST_MAX_DURATION_SECONDS=150 \.\/scripts\/test-runner\.sh \\\n\s+--reporter=verbose 2>&1 \| tee \.performance\/ci-code-integration\/test-run\.log/u
);
assert.match(
  integration.run,
  /validateCodeIntegrationReceipt\(process\.env\.GEOROIDS_CODE_INTEGRATION_RECEIPT\)/u
);
assert.doesNotMatch(integration.run, /tests\/integration\/|--exclude|--shard|testNamePattern/u);
const integrationUpload = integrationSteps.find(
  (step) => step.name === 'Upload code integration artifacts'
);
assert.equal(integrationUpload.with.path, '.performance/ci-code-integration');
assert.equal(integrationUpload.with['include-hidden-files'], true);
assert.equal(integrationUpload.with['if-no-files-found'], 'error');
assert.match(integrationUpload.if, /always\(\)/u);
for (const job of Object.values(ci.jobs)) {
  for (const step of job.steps) {
    assert.doesNotMatch(
      step.run ?? '',
      /playwright install|chromium|webkit|tests\/integration\/browser/u
    );
  }
}
const manifest = JSON.parse(read('package.json'));
// Manual measurements are explicit user entrypoints, never hidden validation.
const manualMeasurement =
  /playwright|puppeteer|--benchmark-(?:client|load)|benchmark:(?:realtime|load)|measure-frame-work/u;
for (const [name, command] of Object.entries(manifest.scripts)) {
  if (/^(?:test(?::|$)|check:|gate$|fix$)/u.test(name)) {
    assert.doesNotMatch(command, manualMeasurement, `${name} must remain code-only validation`);
    // Wiki media belongs to linux-x64 and its CI lane; local validation must pass on macOS too.
    assert.doesNotMatch(
      command,
      /wiki:media|wiki-media\.ts/u,
      `${name} must not render Wiki media`
    );
  }
}
for (const file of ['.github/workflows/ci.yml', '.github/workflows/production-smoke.yml']) {
  const workflow = parse(read(file));
  for (const job of Object.values(workflow.jobs)) {
    for (const step of job.steps) {
      assert.doesNotMatch(
        step.run ?? '',
        manualMeasurement,
        `${file} must not invoke manual measurements`
      );
    }
  }
}
assert.equal(manifest.scripts['test:integration'], './scripts/test-runner.sh --reporter=verbose');
assert.equal(manifest.scripts['test:all'], 'npm run test && npm run test:integration');
assert.equal(
  manifest.scripts['check:test-runner'],
  "node scripts/validation-admission.mjs contracts -- bash -c 'bash scripts/test-runner-contract.sh && node --test scripts/test-ports.test.mjs scripts/validation-admission.test.mjs scripts/check-built-client.test.mjs scripts/check-unused-typescript.test.mjs'"
);
assert.match(
  read('scripts/test-runner-contract.sh'),
  /^exec node --test scripts\/code-integration-runner\.test\.mjs scripts\/benchmark-runner\.test\.mjs scripts\/benchmark-build-receipt\.test\.mjs$/mu
);
assert.equal(
  manifest.scripts['check:actions'],
  'node --import tsx --test scripts/server-release-inputs.test.mjs scripts/production-smoke-scenario.test.mjs && node scripts/ci-contract.mjs && node --test scripts/gate-contract.test.mjs && node scripts/review-receipt-contract.mjs && bash scripts/check-actions.sh'
);
assert.equal(
  manifest.scripts['smoke:production'],
  'node --import tsx scripts/production-smoke-entry.mjs'
);
assert.equal(
  manifest.scripts['smoke:scenario-contract'],
  'node --import tsx --test scripts/server-release-inputs.test.mjs scripts/production-smoke-scenario.test.mjs'
);
assert.ok(
  manifest.devDependencies.playwright,
  'Manual browser benchmarks and frame measurements still need Playwright'
);
assert.equal(manifest.scripts['benchmark:realtime'], './scripts/test-runner.sh --benchmark-client');
assert.equal(manifest.scripts['benchmark:load'], './scripts/test-runner.sh --benchmark-load');
for (const command of Object.keys(manifest.scripts)) {
  assert.doesNotMatch(command, /^test:integration:(?:browser|sharded)/u);
}
const production = parse(read('.github/workflows/production-smoke.yml'));
assert.doesNotMatch(
  read('.github/workflows/production-smoke.yml'),
  /playwright install|chromium|webkit/u
);
const releaseGuard = production.jobs.smoke.steps.find(
  (step) => step.name === 'Verify the release belongs to main'
)?.run;
assert.equal(
  releaseGuard,
  '[[ "$PRODUCTION_SMOKE_RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]] || exit 1\ngit merge-base --is-ancestor "$PRODUCTION_SMOKE_RELEASE_SHA" origin/main\n'
);
assert.equal(production.jobs.smoke.steps[0].with['fetch-depth'], 0);
assert.match(production.jobs.smoke.if, /github\.event\.deployment\.ref == 'main'/u);
assert.match(production.jobs.smoke.if, /github\.event\.deployment\.ref == 'refs\/heads\/main'/u);
assert.match(
  production.jobs.smoke.if,
  /github\.event\.deployment\.ref == github\.event\.deployment\.sha/u
);
assert.ok(
  production.jobs.smoke.if.includes(
    "github.event.deployment_status.environment_url == 'https://railway.com/project/08a7b6ee-af66-4c58-a21e-700d5468ee14?environmentId=94d3de2f-4bb0-4051-8975-a30190c2fffa'"
  )
);
const productionCommands = production.jobs.smoke.steps.map((step) => step.run).filter(Boolean);
assert.deepEqual(productionCommands, [
  releaseGuard,
  'npm ci',
  'npm run smoke:scenario-contract',
  'npm run smoke:production',
]);

// Execute the actual integration pipeline with coded runner/tee/receipt outcomes.
// No app service or gameplay workload is started by these shell fixtures.
const fixture = mkdtempSync(join(tmpdir(), 'georoids-ci-pipeline-'));
try {
  mkdirSync(join(fixture, 'scripts'));
  mkdirSync(join(fixture, 'bin'));
  mkdirSync(join(fixture, '.performance/ci-code-integration'), { recursive: true });
  writeFileSync(
    join(fixture, 'scripts/test-runner.sh'),
    '#!/bin/sh\nprintf "coded integration output\\n"\nexit "$CODED_RUNNER_EXIT"\n',
    { mode: 0o755 }
  );
  writeFileSync(
    join(fixture, 'bin/tee'),
    '#!/bin/sh\ncat > "$1"\ncat "$1"\nexit "$CODED_TEE_EXIT"\n',
    { mode: 0o755 }
  );
  const called = join(fixture, 'receipt-called');
  writeFileSync(
    join(fixture, 'bin/node'),
    '#!/bin/sh\nprintf "%s\\n" "$*" >> "$CODED_RECEIPT_CALLED"\nexit "$CODED_RECEIPT_EXIT"\n',
    { mode: 0o755 }
  );
  for (const runnerExit of [0, 7]) {
    for (const teeExit of [0, 8]) {
      for (const receiptExit of [0, 9]) {
        rmSync(called, { force: true });
        const result = spawnSync('bash', ['-c', integration.run], {
          cwd: fixture,
          env: {
            ...process.env,
            PATH: `${join(fixture, 'bin')}:${process.env.PATH}`,
            CODED_RUNNER_EXIT: String(runnerExit),
            CODED_TEE_EXIT: String(teeExit),
            CODED_RECEIPT_EXIT: String(receiptExit),
            CODED_RECEIPT_CALLED: called,
            GEOROIDS_CODE_INTEGRATION_RECEIPT: join(
              fixture,
              '.performance/ci-code-integration/runner.json'
            ),
          },
          encoding: 'utf8',
        });
        assert.equal(result.error, undefined);
        assert.equal(result.status === 0, runnerExit === 0 && teeExit === 0 && receiptExit === 0);
        if (runnerExit === 0 && teeExit === 0) {
          assert.match(readFileSync(called, 'utf8'), /validateCodeIntegrationReceipt/u);
        } else {
          assert.equal(existsSync(called), false);
        }
      }
    }
  }
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

// The media lane verifies the committed baseline. Only after that check fails does it render a
// candidate outside the checkout and upload it for review; CI never writes the committed assets.
assert.equal(manifest.scripts['wiki:media:check'], 'tsx scripts/wiki-media.ts --verify');
assert.equal(manifest.scripts['wiki:media'], 'tsx scripts/wiki-media.ts');
const mediaSteps = ci.jobs['wiki-media'].steps;
assert.deepEqual(
  mediaSteps.filter((step) => /^npm run /u.test(step.run ?? '')).map((step) => step.run),
  ['npm run wiki:media:check', 'npm run wiki:media -- --output "$RUNNER_TEMP/wiki-media-baseline"']
);
const mediaCheck = mediaSteps.find((step) => step.run === 'npm run wiki:media:check');
assert.equal(mediaCheck.id, 'wiki-media');
assert.equal(mediaCheck.if, "steps.verified-tree.outputs.run_full != 'false'");
const mediaCandidate = mediaSteps.filter(
  (step) => step.if === "failure() && steps.wiki-media.outcome == 'failure'"
);
assert.deepEqual(
  mediaCandidate.map((step) => step.run ?? step.uses),
  [
    'npm run wiki:media -- --output "$RUNNER_TEMP/wiki-media-baseline"',
    'actions/upload-artifact@v7',
  ]
);
assert.equal(mediaCandidate[1].with.path, `\${{ runner.temp }}/wiki-media-baseline`);

// Execute the actual aggregate step for all 256 GitHub dependency outcomes.
const aggregate = required.steps.find(
  (step) => step.name === 'Require all four validation lanes to pass'
);
assert.ok(aggregate);
const laneResults = {
  STATIC_RESULT: 'static-checks',
  RUNNER_RESULT: 'runner-contracts',
  INTEGRATION_RESULT: 'integration-tests',
  WIKI_MEDIA_RESULT: 'wiki-media',
};
for (const [variable, lane] of Object.entries(laneResults)) {
  assert.equal(aggregate.env[variable], `\${{ needs.${lane}.result }}`);
}
const outcomes = ['success', 'failure', 'cancelled', 'skipped'];
const combinations = Object.keys(laneResults).reduce(
  (rows, variable) =>
    rows.flatMap((row) => outcomes.map((outcome) => ({ ...row, [variable]: outcome }))),
  [{}]
);
assert.equal(combinations.length, 256);
for (const results of combinations) {
  const result = spawnSync('bash', ['-c', aggregate.run], {
    env: { ...process.env, ...results },
    encoding: 'utf8',
  });
  assert.equal(result.error, undefined);
  assert.equal(
    result.status === 0,
    Object.values(results).every((outcome) => outcome === 'success')
  );
}

process.stdout.write(
  'CI contracts passed: four parallel lanes, exact command coverage, fail-closed aggregation, mandatory local tests, and failure propagation.\n'
);
