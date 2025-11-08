#!/usr/bin/env node
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { fm: {}, body: text };
  const raw = m[1];
  const body = m[2];
  const fm = {};
  for (const line of raw.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^"|"$/g, '');
    if (key) fm[key] = value;
  }
  return { fm, body };
}

function fail(msg) {
  console.error(`\n[doc:check-sync] ${msg}\n`);
  process.exit(1);
}

const root = process.cwd();
const plansDir = join(root, 'Plans');
const philosophiesDir = join(root, 'Philosophies');
const tasksDir = join(root, 'Tasks');

if (!existsSync(plansDir) || !existsSync(philosophiesDir) || !existsSync(tasksDir)) {
  fail('Expected Plans/, Philosophies/, and Tasks/ directories to exist.');
}

const planFiles = readdirSync(plansDir).filter((f) => f.endsWith('.md'));
let checked = 0;

for (const planFile of planFiles) {
  const planPath = join(plansDir, planFile);
  const planText = readFileSync(planPath, 'utf8');
  const { fm: planFm } = parseFrontmatter(planText);
  if (!planFm.doc || planFm.doc !== 'plan') continue; // skip non-plan md

  if (!planFm.version) {
    fail(`Plan ${planFile} missing 'version' in frontmatter.`);
  }

  const base = basename(planFile, '.md');
  const expectedPhilosophy = `${base}-philosophy.md`;
  const expectedTasks = `${base}.md`;

  const philosophyPath = join(philosophiesDir, expectedPhilosophy);
  if (!existsSync(philosophyPath)) {
    fail(`Missing companion philosophy for ${planFile}. Expected Philosophies/${expectedPhilosophy}`);
  }

  const tasksPath = join(tasksDir, expectedTasks);
  if (!existsSync(tasksPath)) {
    fail(`Missing companion tasks doc for ${planFile}. Expected Tasks/${expectedTasks}`);
  }

  const phText = readFileSync(philosophyPath, 'utf8');
  const { fm: phFm } = parseFrontmatter(phText);
  if (phFm.doc !== 'philosophy') {
    fail(`Philosophy doc ${expectedPhilosophy} missing frontmatter 'doc: philosophy'.`);
  }
  if (!phFm.planVersion) {
    fail(`Philosophy ${expectedPhilosophy} missing 'planVersion' in frontmatter.`);
  }
  if (phFm.planVersion !== planFm.version) {
    fail(`${expectedPhilosophy} planVersion (${phFm.planVersion}) does not match ${planFile} version (${planFm.version}). Update philosophy and bump planVersion.`);
  }
  if (phFm.planRef && phFm.planRef !== `Plans/${planFile}`) {
    fail(`${expectedPhilosophy} planRef (${phFm.planRef}) should point to Plans/${planFile}.`);
  }

  const tasksText = readFileSync(tasksPath, 'utf8');
  const { fm: tasksFm } = parseFrontmatter(tasksText);
  if (tasksFm.doc !== 'tasks') {
    fail(`Tasks doc ${expectedTasks} missing frontmatter 'doc: tasks'.`);
  }
  if (tasksFm.planRef && tasksFm.planRef !== `Plans/${planFile}`) {
    fail(`${expectedTasks} planRef (${tasksFm.planRef}) should point to Plans/${planFile}.`);
  }
  if (tasksFm.planVersion && tasksFm.planVersion !== planFm.version) {
    fail(`${expectedTasks} planVersion (${tasksFm.planVersion}) does not match ${planFile} version (${planFm.version}).`);
  }
  if (tasksFm.philosophyRef && planFm.philosophyRef && tasksFm.philosophyRef !== planFm.philosophyRef) {
    fail(`${expectedTasks} philosophyRef (${tasksFm.philosophyRef}) does not match plan philosophyRef (${planFm.philosophyRef}).`);
  }

  if (planFm.philosophyRef && planFm.philosophyRef !== `Philosophies/${expectedPhilosophy}`) {
    fail(`${planFile} philosophyRef (${planFm.philosophyRef}) should be Philosophies/${expectedPhilosophy}.`);
  }
  if (planFm.tasksRef && planFm.tasksRef !== `Tasks/${expectedTasks}`) {
    fail(`${planFile} tasksRef (${planFm.tasksRef}) should be Tasks/${expectedTasks}.`);
  }

  checked++;
}

if (checked === 0) {
  console.log('[doc:check-sync] No plan docs found to validate.');
} else {
  console.log(`[doc:check-sync] Validated ${checked} plan/philosophy/tasks set(s).`);
}

