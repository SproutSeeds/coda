#!/usr/bin/env node
import { execSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  readdirSync,
  mkdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const root = process.cwd();
const plansDir = join(root, 'Plans');
const philosophiesDir = join(root, 'Philosophies');
const tasksDir = join(root, 'Tasks');
const today = new Date().toISOString().slice(0, 10);

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { fm: {}, body: content, hasFrontmatter: false };
  }
  const raw = match[1];
  const body = match[2];
  const fm = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    fm[key] = value;
  }
  return { fm, body, hasFrontmatter: true };
}

function composeFrontmatter(fm, preferredOrder) {
  const keys = [...new Set([...(preferredOrder || []), ...Object.keys(fm)])];
  return `---\n${keys
    .filter((key) => fm[key] !== undefined)
    .map((key) => `${key}: ${fm[key]}`)
    .join('\n')}\n---\n`;
}

function toSlug(branch) {
  return branch
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function toTitle(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function ensureDirs() {
  if (!existsSync(plansDir)) mkdirSync(plansDir, { recursive: true });
  if (!existsSync(philosophiesDir)) mkdirSync(philosophiesDir, { recursive: true });
  if (!existsSync(tasksDir)) mkdirSync(tasksDir, { recursive: true });
}

function updateHeading(body, heading) {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const idx = lines.findIndex((line) => line.startsWith('# '));
  if (idx === -1) {
    lines.unshift(`# ${heading}`, '');
  } else {
    lines[idx] = `# ${heading}`;
  }
  return `${lines.join('\n')}`;
}

function updatePhilosophyBody(body, planSlug, planTitle) {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const heading = `${planTitle} — Philosophy`;
  const headingIdx = lines.findIndex((line) => line.startsWith('# '));
  if (headingIdx === -1) {
    lines.unshift(`# ${heading}`, '');
  } else {
    lines[headingIdx] = `# ${heading}`;
  }
  const companionLine = `Companion to: ../Plans/${planSlug}.md`;
  const companionIdx = lines.findIndex((line) => line.startsWith('Companion to: '));
  if (companionIdx === -1) {
    lines.splice(headingIdx + 1, 0, companionLine, '');
  } else {
    lines[companionIdx] = companionLine;
  }
  return `${lines.join('\n')}`;
}

function updateTasksBody(body, planTitle) {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const heading = `${planTitle} — Task List`;
  const headingIdx = lines.findIndex((line) => line.startsWith('# '));
  if (headingIdx === -1) {
    lines.unshift(`# ${heading}`, '');
  } else {
    lines[headingIdx] = `# ${heading}`;
  }
  return `${lines.join('\n')}`;
}

function updatePlanFile(planPath, planSlug, planTitle, planVersion) {
  const content = readFileSync(planPath, 'utf8');
  const { fm, body } = parseFrontmatter(content);
  fm.doc = 'plan';
  fm.id = planSlug;
  if (planVersion) fm.version = planVersion;
  fm.philosophyRef = `Philosophies/${planSlug}-philosophy.md`;
  fm.tasksRef = `Tasks/${planSlug}.md`;

  const newBody = updateHeading(body, `${planTitle} — Implementation Plan`);
  const newContent = composeFrontmatter(fm, ['doc', 'id', 'version', 'lastUpdated', 'philosophyRef', 'tasksRef']) + newBody;
  writeFileSync(planPath, newContent, 'utf8');
}

function ensurePhilosophyFile(philosophyPath, planSlug, planTitle, planVersion) {
  if (!existsSync(philosophyPath)) {
    const stub = composeFrontmatter(
      {
        doc: 'philosophy',
        id: planSlug,
        planRef: `Plans/${planSlug}.md`,
        planVersion: planVersion || '0.1.0',
        lastReviewed: today,
        reviewCadence: 'monthly',
      },
      ['doc', 'id', 'planRef', 'planVersion', 'lastReviewed', 'reviewCadence']
    );
    const body = `# ${planTitle} — Philosophy\n\nCompanion to: ../Plans/${planSlug}.md\n`;
    writeFileSync(philosophyPath, stub + body, 'utf8');
    return;
  }

  const content = readFileSync(philosophyPath, 'utf8');
  const { fm, body } = parseFrontmatter(content);
  fm.doc = 'philosophy';
  fm.id = planSlug;
  fm.planRef = `Plans/${planSlug}.md`;
  if (planVersion) fm.planVersion = planVersion;
  fm.lastReviewed = today;
  if (!fm.reviewCadence) fm.reviewCadence = 'monthly';

  const newBody = updatePhilosophyBody(body, planSlug, planTitle);
  const newContent = composeFrontmatter(fm, ['doc', 'id', 'planRef', 'planVersion', 'lastReviewed', 'reviewCadence']) + newBody;
  writeFileSync(philosophyPath, newContent, 'utf8');
}

function ensureTasksFile(tasksPath, planSlug, planTitle, planVersion) {
  if (!existsSync(tasksPath)) {
    const body = `# ${planTitle} — Task List\n\n## Task Groups\n- [ ] Define workstreams based on the implementation plan.\n\n`;
    const stub = composeFrontmatter(
      {
        doc: 'tasks',
        id: planSlug,
        planRef: `Plans/${planSlug}.md`,
        planVersion: planVersion || '0.1.0',
        philosophyRef: `Philosophies/${planSlug}-philosophy.md`,
        lastUpdated: today,
        status: 'draft',
      },
      ['doc', 'id', 'planRef', 'planVersion', 'philosophyRef', 'lastUpdated', 'status']
    );
    writeFileSync(tasksPath, stub + body, 'utf8');
    return;
  }

  const content = readFileSync(tasksPath, 'utf8');
  const { fm, body } = parseFrontmatter(content);
  fm.doc = 'tasks';
  fm.id = planSlug;
  fm.planRef = `Plans/${planSlug}.md`;
  let changed = false;
  if (planVersion && fm.planVersion !== planVersion) {
    fm.planVersion = planVersion;
    changed = true;
  }
  if (fm.philosophyRef !== `Philosophies/${planSlug}-philosophy.md`) {
    fm.philosophyRef = `Philosophies/${planSlug}-philosophy.md`;
    changed = true;
  }
  if (!fm.status) {
    fm.status = 'draft';
    changed = true;
  }
  if (!fm.lastUpdated) {
    fm.lastUpdated = today;
    changed = true;
  } else if (changed) {
    fm.lastUpdated = today;
  }

  const newBody = updateTasksBody(body, planTitle);
  const newContent = composeFrontmatter(fm, ['doc', 'id', 'planRef', 'planVersion', 'philosophyRef', 'lastUpdated', 'status']) + newBody;
  writeFileSync(tasksPath, newContent, 'utf8');
}

function planFilesList() {
  return readdirSync(plansDir)
    .filter((file) => file.endsWith('.md') && file !== 'README.md')
    .map((file) => file.replace(/\.md$/, ''));
}

async function promptExistingPlan() {
  const rl = createInterface({ input, output });
  const answer = (await rl.question('Enter an existing plan filename (without .md) to repurpose, or press Enter to scaffold a new plan: ')).trim();
  rl.close();
  return answer;
}

function renamePlanFamily(oldSlug, newSlug) {
  const oldPlanPath = join(plansDir, `${oldSlug}.md`);
  const newPlanPath = join(plansDir, `${newSlug}.md`);
  renameSync(oldPlanPath, newPlanPath);

  const oldPhilosophyPath = join(philosophiesDir, `${oldSlug}-philosophy.md`);
  const newPhilosophyPath = join(philosophiesDir, `${newSlug}-philosophy.md`);
  if (existsSync(oldPhilosophyPath)) {
    renameSync(oldPhilosophyPath, newPhilosophyPath);
  }

  const oldTasksPath = join(tasksDir, `${oldSlug}.md`);
  const newTasksPath = join(tasksDir, `${newSlug}.md`);
  if (existsSync(oldTasksPath)) {
    renameSync(oldTasksPath, newTasksPath);
  }

  return { planPath: newPlanPath, philosophyPath: newPhilosophyPath, tasksPath: newTasksPath };
}

function scaffoldPlan(planPath, planSlug, planTitle) {
  const stub = composeFrontmatter(
    {
      doc: 'plan',
      id: planSlug,
      version: '0.1.0',
      lastUpdated: today,
      philosophyRef: `Philosophies/${planSlug}-philosophy.md`,
      tasksRef: `Tasks/${planSlug}.md`,
    },
    ['doc', 'id', 'version', 'lastUpdated', 'philosophyRef', 'tasksRef']
  );

  const body = `# ${planTitle} — Implementation Plan\n\n## Goals\n- [ ] Define the measurable outcomes for this branch.\n\n## In Scope\n- [ ] Enumerate the features or tasks covered by this branch.\n\n## Out of Scope\n- [ ] Call out work that will explicitly wait for another plan.\n\n## Delivery Checklist\n- [ ] Data layer updates\n- [ ] Server actions / APIs\n- [ ] UI/UX adjustments\n- [ ] Tests (unit / integration / e2e)\n\n## Rollout & QA\n- [ ] Manual QA scenarios\n- [ ] Observability / alerts\n- [ ] Post-merge follow-ups\n`;

  writeFileSync(planPath, stub + body, 'utf8');
}

function runDocSync() {
  const docSyncPath = join(root, 'scripts', 'doc-sync-local.mjs');
  if (existsSync(docSyncPath)) {
    run(`node ${JSON.stringify(docSyncPath)}`);
  }
}

function runDocCheck() {
  const docCheckPath = join(root, 'scripts', 'check-doc-sync.mjs');
  if (existsSync(docCheckPath)) {
    run(`node ${JSON.stringify(docCheckPath)}`);
  }
}

async function main() {
  ensureDirs();

  let branch = 'HEAD';
  try {
    branch = run('git rev-parse --abbrev-ref HEAD');
  } catch (error) {
    console.error('[guard] Not inside a git repository.');
    process.exit(1);
  }

  if (!branch || branch === 'HEAD') {
    console.error('[guard] Detached HEAD detected. Checkout a branch before continuing.');
    process.exit(1);
  }

  const protectedBranches = ['main', 'master', 'develop', 'release', 'staging'];
  const isCI = process.env.CI === 'true' || process.env.VERCEL === '1' || process.env.GITHUB_ACTIONS === 'true';

  if (protectedBranches.includes(branch)) {
    if (isCI) {
      console.log(`[guard] Protected branch "${branch}" detected in CI/CD environment. Skipping guard checks.`);
      process.exit(0);
    }
    console.error(`[guard] Branch "${branch}" is protected. Create a feature branch before working.`);
    process.exit(1);
  }

  const planSlug = toSlug(branch);
  if (!planSlug) {
    console.error('[guard] Unable to derive plan slug from branch name.');
    process.exit(1);
  }

  const planTitle = toTitle(planSlug);
  const planPath = join(plansDir, `${planSlug}.md`);
  const philosophyPath = join(philosophiesDir, `${planSlug}-philosophy.md`);
  const tasksPath = join(tasksDir, `${planSlug}.md`);

  if (!existsSync(planPath)) {
    console.log(`[guard] No plan file found for branch "${branch}".`);
    const plans = planFilesList();
    if (plans.length) {
      console.log('Existing plans in repo:');
      for (const file of plans) {
        console.log(`  • ${file}`);
      }
    } else {
      console.log('No existing plans detected in Plans/. A new stub will be created.');
    }

    const response = await promptExistingPlan();
    if (response) {
      const candidate = response.endsWith('.md') ? response : `${response}.md`;
      const candidateSlug = candidate.replace(/\.md$/, '');
      const candidatePath = join(plansDir, candidate);
      if (!existsSync(candidatePath)) {
        console.error(`[guard] Plan "${candidate}" not found under Plans/.`);
        process.exit(1);
      }
      const candidateContent = readFileSync(candidatePath, 'utf8');
      const { fm } = parseFrontmatter(candidateContent);
      const candidateVersion = fm.version || '0.1.0';
      const { planPath: newPlanPath } = renamePlanFamily(candidateSlug, planSlug);
      updatePlanFile(newPlanPath, planSlug, planTitle, candidateVersion);
      ensurePhilosophyFile(philosophyPath, planSlug, planTitle, candidateVersion);
      ensureTasksFile(tasksPath, planSlug, planTitle, candidateVersion);
      console.log(`[guard] Renamed plan ${candidate} -> ${planSlug}.md and synced companions.`);
    } else {
      scaffoldPlan(planPath, planSlug, planTitle);
      ensurePhilosophyFile(philosophyPath, planSlug, planTitle, '0.1.0');
      ensureTasksFile(tasksPath, planSlug, planTitle, '0.1.0');
      console.log(`[guard] Scaffolded new plan, philosophy, and tasks for ${planSlug}.`);
    }
  } else {
    const planContent = readFileSync(planPath, 'utf8');
    const { fm } = parseFrontmatter(planContent);
    const planVersion = fm.version || '0.1.0';
    updatePlanFile(planPath, planSlug, planTitle, planVersion);
    ensurePhilosophyFile(philosophyPath, planSlug, planTitle, planVersion);
    ensureTasksFile(tasksPath, planSlug, planTitle, planVersion);
  }

  runDocSync();
  runDocCheck();

  console.log(`[guard] Ready: branch "${branch}" ↔ plan "Plans/${planSlug}.md" ↔ philosophy "Philosophies/${planSlug}-philosophy.md" ↔ tasks "Tasks/${planSlug}.md".`);
}

main().catch((error) => {
  console.error('[guard] Enforcement failed:', error.message);
  process.exit(1);
});
