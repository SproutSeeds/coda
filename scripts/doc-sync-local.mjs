#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { basename, join } from 'path';

function normalizeNewlines(text) {
  return text.replace(/\r\n/g, '\n');
}

function parseFrontmatter(text) {
  const normalized = normalizeNewlines(text);
  if (!normalized.startsWith('---\n')) {
    return { fm: {}, body: normalized, hasFrontmatter: false };
  }
  const endIndex = normalized.indexOf('\n---\n', 4);
  if (endIndex === -1) {
    throw new Error('Invalid frontmatter block');
  }
  const raw = normalized.slice(4, endIndex);
  const body = normalized.slice(endIndex + 5);
  const fm = {};
  for (const line of raw.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) fm[key] = value;
  }
  return { fm, body, hasFrontmatter: true };
}

function stringifyFrontmatter(fm, order) {
  const keys = [...new Set([...(order || []), ...Object.keys(fm)])];
  const lines = keys
    .filter((key) => fm[key] !== undefined)
    .map((key) => `${key}: ${fm[key]}`);
  return `---\n${lines.join('\n')}\n---\n`;
}

function slugToTitle(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function extractPlanTitle(planBody, fallback) {
  const match = planBody.match(/^#\s+(.+?)\s*(?:\n|$)/m);
  if (!match) return fallback;
  const heading = match[1].trim();
  return heading.replace(/\s+—.*$/, '').trim() || fallback;
}

const today = new Date().toISOString().slice(0, 10);
const root = process.cwd();
const plansDir = join(root, 'Plans');
const philosophiesDir = join(root, 'Philosophies');
const tasksDir = join(root, 'Tasks');

if (!existsSync(plansDir)) {
  console.error('Plans directory not found. Nothing to sync.');
  process.exit(0);
}
if (!existsSync(philosophiesDir)) {
  mkdirSync(philosophiesDir, { recursive: true });
}
if (!existsSync(tasksDir)) {
  mkdirSync(tasksDir, { recursive: true });
}

const planFiles = readdirSync(plansDir).filter((f) => f.endsWith('.md'));
const updates = [];

for (const planFile of planFiles) {
  const planPath = join(plansDir, planFile);
  const rawPlan = readFileSync(planPath, 'utf8');
  const { fm: planFmOrig, body: planBody, hasFrontmatter } = parseFrontmatter(rawPlan);
  if (!hasFrontmatter) continue;
  if (planFmOrig.doc !== 'plan') continue;

  const base = basename(planFile, '.md');
  const planId = planFmOrig.id || base;
  const planVersion = planFmOrig.version || '0.0.0';
  const planRef = `Plans/${planFile}`;
  const philosophyRef = `Philosophies/${base}-philosophy.md`;
  const tasksRef = `Tasks/${base}.md`;

  const planFm = { ...planFmOrig };
  let planChanged = false;

  if (planFm.doc !== 'plan') {
    planFm.doc = 'plan';
    planChanged = true;
  }
  if (planFm.id !== planId) {
    planFm.id = planId;
    planChanged = true;
  }
  if (planFm.philosophyRef !== philosophyRef) {
    planFm.philosophyRef = philosophyRef;
    planChanged = true;
  }
  if (planFm.tasksRef !== tasksRef) {
    planFm.tasksRef = tasksRef;
    planChanged = true;
  }

  if (planChanged) {
    const planContent = stringifyFrontmatter(planFm, ['doc', 'id', 'version', 'lastUpdated', 'philosophyRef', 'tasksRef']) + planBody;
    writeFileSync(planPath, planContent, 'utf8');
    updates.push(`updated ${planFile}`);
  }

  const planTitle = extractPlanTitle(planBody, slugToTitle(planId));

  // Philosophy sync
  const philosophyFile = `${base}-philosophy.md`;
  const philosophyPath = join(philosophiesDir, philosophyFile);

  if (!existsSync(philosophyPath)) {
    const content =
      stringifyFrontmatter(
        {
          doc: 'philosophy',
          id: planId,
          planRef,
          planVersion,
          lastReviewed: today,
          reviewCadence: planFm.reviewCadence || 'monthly',
        },
        ['doc', 'id', 'planRef', 'planVersion', 'lastReviewed', 'reviewCadence']
      ) + `\n# ${planTitle} — Philosophy\n\nCompanion to: ${planRef}\n`;
    writeFileSync(philosophyPath, content, 'utf8');
    updates.push(`created ${philosophyFile}`);
  } else {
    const rawPh = readFileSync(philosophyPath, 'utf8');
    const { fm: phFmOrig, body: phBody, hasFrontmatter: hasPhFm } = parseFrontmatter(rawPh);
    if (!hasPhFm) {
      throw new Error(`Philosophy file ${philosophyFile} missing frontmatter.`);
    }
    const phFm = { ...phFmOrig };
    let phChanged = false;
    if (phFm.doc !== 'philosophy') {
      phFm.doc = 'philosophy';
      phChanged = true;
    }
    if (phFm.id !== planId) {
      phFm.id = planId;
      phChanged = true;
    }
    if (phFm.planRef !== planRef) {
      phFm.planRef = planRef;
      phChanged = true;
    }
    if (phFm.planVersion !== planVersion) {
      phFm.planVersion = planVersion;
      phChanged = true;
    }
    const cadence = phFm.reviewCadence || phFmOrig.reviewCadence || 'monthly';
    if (phFm.reviewCadence !== cadence) {
      phFm.reviewCadence = cadence;
      phChanged = true;
    }
    if (phChanged || phFm.lastReviewed !== today) {
      phFm.lastReviewed = today;
      phChanged = true;
    }
    if (phChanged) {
      const content = stringifyFrontmatter(phFm, ['doc', 'id', 'planRef', 'planVersion', 'lastReviewed', 'reviewCadence']) + '\n' + phBody;
      writeFileSync(philosophyPath, content, 'utf8');
      updates.push(`updated ${philosophyFile}`);
    }
  }

  // Tasks sync
  const tasksFile = `${base}.md`;
  const tasksPath = join(tasksDir, tasksFile);
  const defaultTasksBody = `# ${planTitle} — Task List\n\n## Task Groups\n- [ ] Define workstreams based on the implementation plan.\n\n`; // placeholder; real docs should edit

  if (!existsSync(tasksPath)) {
    const content =
      stringifyFrontmatter(
        {
          doc: 'tasks',
          id: planId,
          planRef,
          planVersion,
          philosophyRef,
          lastUpdated: today,
          status: 'draft',
        },
        ['doc', 'id', 'planRef', 'planVersion', 'philosophyRef', 'lastUpdated', 'status']
      ) + '\n' + defaultTasksBody;
    writeFileSync(tasksPath, content, 'utf8');
    updates.push(`created ${tasksFile}`);
  } else {
    const rawTasks = readFileSync(tasksPath, 'utf8');
    const { fm: tasksFmOrig, body: tasksBody, hasFrontmatter: hasTasksFm } = parseFrontmatter(rawTasks);
    if (!hasTasksFm) {
      throw new Error(`Tasks file ${tasksFile} missing frontmatter.`);
    }
    const tasksFm = { ...tasksFmOrig };
    let tasksChanged = false;
    if (tasksFm.doc !== 'tasks') {
      tasksFm.doc = 'tasks';
      tasksChanged = true;
    }
    if (tasksFm.id !== planId) {
      tasksFm.id = planId;
      tasksChanged = true;
    }
    if (tasksFm.planRef !== planRef) {
      tasksFm.planRef = planRef;
      tasksChanged = true;
    }
    if (tasksFm.planVersion !== planVersion) {
      tasksFm.planVersion = planVersion;
      tasksChanged = true;
    }
    if (tasksFm.philosophyRef !== philosophyRef) {
      tasksFm.philosophyRef = philosophyRef;
      tasksChanged = true;
    }
    if (tasksChanged) {
      tasksFm.lastUpdated = today;
    }
    if (!tasksFm.lastUpdated) {
      tasksFm.lastUpdated = today;
      tasksChanged = true;
    }
    if (!tasksFm.status) {
      tasksFm.status = 'draft';
      tasksChanged = true;
    }
    if (tasksChanged) {
      const content = stringifyFrontmatter(tasksFm, ['doc', 'id', 'planRef', 'planVersion', 'philosophyRef', 'lastUpdated', 'status']) + '\n' + tasksBody;
      writeFileSync(tasksPath, content, 'utf8');
      updates.push(`updated ${tasksFile}`);
    }
  }
}

if (updates.length === 0) {
  console.log('Doc sync: no changes needed.');
} else {
  console.log('Doc sync updates:');
  for (const line of updates) {
    console.log(` - ${line}`);
  }
}

