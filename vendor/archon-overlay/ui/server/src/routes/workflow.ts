/** Local proof-intake workflow: persisted jobs, confirmation gates, and runners. */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, type ChildProcess } from 'child_process';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ProjectPaths } from './project.js';

type WorkflowState =
  | 'AWAITING_REQUEST_CONFIRMATION'
  | 'RETHLAS_RUNNING'
  | 'PROPOSING_LEAN'
  | 'AWAITING_LEAN_CONFIRMATION'
  | 'ARCHON_RUNNING'
  | 'LEAN_VERIFIED'
  | 'NEEDS_ATTENTION'
  | 'FAILED'
  | 'CANCELLED';

interface LeanProposal {
  declarationName: string;
  leanStatement: string;
  plainEnglish: string;
  assumptions: string[];
  leanFile: string;
  compileOk: boolean;
  compileOutput: string;
}

interface WorkflowJob {
  id: string;
  slug: string;
  title: string;
  state: WorkflowState;
  maxIterations: number;
  requestHash: string;
  proposalHash?: string;
  proposal?: LeanProposal;
  referencePath?: string;
  leanFile?: string;
  declarationName?: string;
  error?: string;
  feedback?: string;
  explanationError?: string;
  explanationUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const active = new Map<string, ChildProcess>();
const explanationActive = new Map<string, ChildProcess>();
const SLUG_RE = /^[a-z][a-z0-9_-]{1,63}$/;
const DECL_RE = /\b(?:theorem|lemma)\s+([A-Za-z_][A-Za-z0-9_']*)\b/;

function terminateProcess(child: ChildProcess): void {
  if (!child.pid) return;
  try {
    if (process.platform === 'win32') child.kill('SIGTERM');
    else process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

export function stopWorkflowProcesses(): void {
  for (const child of active.values()) terminateProcess(child);
  for (const child of explanationActive.values()) terminateProcess(child);
  active.clear();
  explanationActive.clear();
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function jobsRoot(paths: ProjectPaths): string {
  return path.join(paths.projectPath, '.proof-workflow', 'jobs');
}

function jobDir(paths: ProjectPaths, id: string): string {
  if (!/^[a-z0-9_-]+$/.test(id)) throw new Error('Invalid job id');
  return path.join(jobsRoot(paths), id);
}

function jobPath(paths: ProjectPaths, id: string): string {
  return path.join(jobDir(paths, id), 'job.json');
}

function readJob(paths: ProjectPaths, id: string): WorkflowJob {
  return JSON.parse(fs.readFileSync(jobPath(paths, id), 'utf8')) as WorkflowJob;
}

function writeJob(paths: ProjectPaths, job: WorkflowJob): void {
  const dir = jobDir(paths, job.id);
  fs.mkdirSync(dir, { recursive: true });
  job.updatedAt = new Date().toISOString();
  const target = jobPath(paths, job.id);
  const temp = `${target}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(job, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temp, target);
}

function appendLog(paths: ProjectPaths, id: string, text: string): void {
  fs.appendFileSync(path.join(jobDir(paths, id), 'workflow.log'), text, 'utf8');
}

function sameOrigin(req: FastifyRequest): boolean {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

function publicJob(paths: ProjectPaths, job: WorkflowJob) {
  const requestPath = path.join(jobDir(paths, job.id), 'request.md');
  const logPath = path.join(jobDir(paths, job.id), 'workflow.log');
  const explanationPath = path.join(jobDir(paths, job.id), 'blueprint-explanation.md');
  const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
  let blueprintMarkdown: string | undefined;
  try {
    blueprintMarkdown = fs.readFileSync(verifiedReferencePath(paths, job), 'utf8');
  } catch {
    blueprintMarkdown = undefined;
  }
  return {
    ...job,
    requestMarkdown: fs.existsSync(requestPath) ? fs.readFileSync(requestPath, 'utf8') : '',
    blueprintExplanation: fs.existsSync(explanationPath) ? fs.readFileSync(explanationPath, 'utf8') : undefined,
    blueprintMarkdown,
    logTail: log.slice(-30000),
    active: active.has(job.id),
    explanationActive: explanationActive.has(job.id),
  };
}

function listJobs(paths: ProjectPaths): WorkflowJob[] {
  const root = jobsRoot(paths);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root)
    .filter(id => fs.existsSync(jobPath(paths, id)))
    .map(id => readJob(paths, id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function bin(paths: ProjectPaths, name: string): string {
  return path.join(paths.projectPath, 'bin', name);
}

function runCommand(
  paths: ProjectPaths,
  job: WorkflowJob,
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<number> {
  return new Promise((resolve, reject) => {
    const logPath = path.join(jobDir(paths, job.id), 'workflow.log');
    const logFd = fs.openSync(logPath, 'a');
    appendLog(paths, job.id, `\n$ ${command} ${args.join(' ')}\n`);
    const child = spawn(command, args, {
      cwd: options.cwd || paths.projectPath,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', logFd, logFd],
      detached: process.platform !== 'win32',
    });
    active.set(job.id, child);
    child.once('error', err => {
      active.delete(job.id);
      fs.closeSync(logFd);
      reject(err);
    });
    child.once('close', code => {
      active.delete(job.id);
      fs.closeSync(logFd);
      resolve(code ?? 1);
    });
  });
}

function runExplanationCommand(
  paths: ProjectPaths,
  job: WorkflowJob,
  command: string,
  args: string[],
): Promise<number> {
  return new Promise((resolve, reject) => {
    const logPath = path.join(jobDir(paths, job.id), 'workflow.log');
    const logFd = fs.openSync(logPath, 'a');
    appendLog(paths, job.id, `\n[Detailed explanation] $ ${command} ${args.join(' ')}\n`);
    const child = spawn(command, args, {
      cwd: paths.projectPath,
      env: process.env,
      stdio: ['ignore', logFd, logFd],
    });
    explanationActive.set(job.id, child);
    child.once('error', err => {
      explanationActive.delete(job.id);
      fs.closeSync(logFd);
      reject(err);
    });
    child.once('close', code => {
      explanationActive.delete(job.id);
      fs.closeSync(logFd);
      resolve(code ?? 1);
    });
  });
}

function verifiedReferencePath(paths: ProjectPaths, job: WorkflowJob): string {
  if (!job.referencePath) throw new Error('This run does not have a verified blueprint yet');
  const referencesRoot = path.resolve(paths.projectPath, 'references');
  const target = path.resolve(paths.projectPath, job.referencePath);
  if (!target.startsWith(`${referencesRoot}${path.sep}`) || !fs.existsSync(target)) {
    throw new Error('Verified blueprint file is unavailable');
  }
  return target;
}

async function explainBlueprint(paths: ProjectPaths, job: WorkflowJob, focus: string): Promise<void> {
  try {
    const referencePath = verifiedReferencePath(paths, job);
    const outputPath = path.join(jobDir(paths, job.id), 'blueprint-explanation.md');
    const current = readJob(paths, job.id);
    current.explanationError = undefined;
    writeJob(paths, current);
    const codex = process.env.CODEX_BIN || process.env.ARCHON_CODEX_BIN || 'codex';
    const focusInstruction = focus
      ? ` Give extra attention to this user request: ${JSON.stringify(focus)}.`
      : '';
    const prompt = `Read ${path.relative(paths.projectPath, referencePath)} and write a standalone, human-readable explanation of its proof. Expand the argument into small numbered steps. Explain why every important algebraic or logical move is valid, how supporting lemmas connect to the main result, and where each assumption is used. Preserve the blueprint's exact mathematical meaning and do not introduce stronger assumptions. Prefer ordinary mathematical language; include Lean code only if it materially clarifies a point.${focusInstruction} Return polished Markdown only.`;
    const code = await runExplanationCommand(paths, job, codex, [
      'exec', '-C', paths.projectPath, '-m', 'gpt-5.6-sol',
      '--config', 'model_reasoning_effort="high"', '--sandbox', 'read-only',
      '-o', outputPath, prompt,
    ]);
    if (code !== 0 || !fs.existsSync(outputPath)) throw new Error('Could not generate the detailed explanation');
    const explanation = fs.readFileSync(outputPath, 'utf8').trim();
    if (explanation.length < 40) throw new Error('The generated explanation was unexpectedly empty');
    fs.writeFileSync(outputPath, `${explanation}\n`, { encoding: 'utf8', mode: 0o600 });
    const latest = readJob(paths, job.id);
    latest.explanationError = undefined;
    latest.explanationUpdatedAt = new Date().toISOString();
    writeJob(paths, latest);
    appendLog(paths, job.id, '\nDetailed human-readable explanation saved.\n');
  } catch (err) {
    const latest = readJob(paths, job.id);
    latest.explanationError = err instanceof Error ? err.message : String(err);
    writeJob(paths, latest);
    appendLog(paths, job.id, `\nEXPLANATION FAILED: ${latest.explanationError}\n`);
  }
}

function setFailed(paths: ProjectPaths, job: WorkflowJob, message: string): void {
  try {
    if (readJob(paths, job.id).state === 'CANCELLED') return;
  } catch { /* job may not have been persisted yet */ }
  job.state = 'FAILED';
  job.error = message;
  appendLog(paths, job.id, `\nFAILED: ${message}\n`);
  writeJob(paths, job);
}

function isCancelled(paths: ProjectPaths, job: WorkflowJob): boolean {
  try { return readJob(paths, job.id).state === 'CANCELLED'; }
  catch { return false; }
}

function assertRequestLocked(paths: ProjectPaths, job: WorkflowJob): void {
  const request = fs.readFileSync(path.join(jobDir(paths, job.id), 'request.md'), 'utf8');
  if (sha256(request) !== job.requestHash) throw new Error('Locked request hash changed');
}

function toPascal(slug: string): string {
  return slug.split(/[-_]+/).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

function cleanStatement(value: string): string {
  let out = value.trim().replace(/^```lean\s*/i, '').replace(/```\s*$/, '').trim();
  out = out.replace(/\s*:=\s*by[\s\S]*$/, '').trim();
  return out;
}

function addProtection(projectPath: string, leanFile: string, declarationName: string): void {
  const protectedPath = path.join(projectPath, 'archon-protected.yaml');
  let content = fs.existsSync(protectedPath) ? fs.readFileSync(protectedPath, 'utf8') : '';
  const activeLean = /^lean:\s*$/m.test(content);
  if (!activeLean) {
    content = content.replace(/\s*$/, '') + `\n\nlean:\n  ${leanFile}:\n    - ${declarationName}\n`;
  } else if (!new RegExp(`^  ${leanFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*$`, 'm').test(content)) {
    const lines = content.split('\n');
    const leanLine = lines.findIndex(line => /^lean:\s*$/.test(line));
    let insertAt = leanLine + 1;
    while (insertAt < lines.length && (lines[insertAt].startsWith('  ') || lines[insertAt].trim() === '')) insertAt++;
    lines.splice(insertAt, 0, `  ${leanFile}:`, `    - ${declarationName}`);
    content = lines.join('\n');
  } else if (!content.includes(`    - ${declarationName}`)) {
    const lines = content.split('\n');
    const fileLine = lines.findIndex(line => line.trim() === `${leanFile}:`);
    lines.splice(fileLine + 1, 0, `    - ${declarationName}`);
    content = lines.join('\n');
  }
  fs.writeFileSync(protectedPath, content, 'utf8');
}

function registerObjective(paths: ProjectPaths, job: WorkflowJob): void {
  const progress = `# Project Progress\n\n## Current Stage\nautoformalize\n\n## Stages\n- [x] init\n- [ ] autoformalize\n- [ ] prover\n- [ ] polish\n\n## Current Objectives\n\n1. \`${job.leanFile}\` — prove \`${job.declarationName}\` using \`${job.referencePath}\`; preserve the protected signature exactly.\n`;
  fs.writeFileSync(path.join(paths.archonPath, 'PROGRESS.md'), progress, 'utf8');
}

async function validateProposal(paths: ProjectPaths, job: WorkflowJob): Promise<void> {
  if (!job.proposal) throw new Error('Missing Lean proposal');
  const tempFile = path.join(os.tmpdir(), `archon-proof-${job.id}.lean`);
  fs.writeFileSync(tempFile, `import Mathlib\n\n${job.proposal.leanStatement} := by\n  sorry\n`, 'utf8');
  const before = fs.existsSync(path.join(jobDir(paths, job.id), 'workflow.log'))
    ? fs.readFileSync(path.join(jobDir(paths, job.id), 'workflow.log'), 'utf8').length : 0;
  const code = await runCommand(paths, job, bin(paths, 'lean'), [tempFile]);
  const log = fs.readFileSync(path.join(jobDir(paths, job.id), 'workflow.log'), 'utf8');
  fs.rmSync(tempFile, { force: true });
  job.proposal.compileOk = code === 0;
  job.proposal.compileOutput = log.slice(before).slice(-8000);
  if (code !== 0) throw new Error('Proposed Lean statement did not compile');
}

async function retryProposalValidation(paths: ProjectPaths, job: WorkflowJob): Promise<void> {
  try {
    if (!job.proposal) throw new Error('Missing Lean proposal');
    job.state = 'PROPOSING_LEAN';
    job.error = undefined;
    writeJob(paths, job);
    await validateProposal(paths, job);
    job.proposalHash = sha256(JSON.stringify(job.proposal));
    job.state = 'AWAITING_LEAN_CONFIRMATION';
    writeJob(paths, job);
  } catch (err) {
    setFailed(paths, job, err instanceof Error ? err.message : String(err));
  }
}

async function proposeLean(paths: ProjectPaths, job: WorkflowJob, feedback = ''): Promise<void> {
  try {
    assertRequestLocked(paths, job);
    job.state = 'PROPOSING_LEAN';
    job.error = undefined;
    writeJob(paths, job);
    const dir = jobDir(paths, job.id);
    const schemaPath = path.join(dir, 'proposal-schema.json');
    const outputPath = path.join(dir, 'proposal.json');
    fs.writeFileSync(schemaPath, JSON.stringify({
      type: 'object', additionalProperties: false,
      properties: {
        declarationName: { type: 'string' }, leanStatement: { type: 'string' },
        plainEnglish: { type: 'string' }, assumptions: { type: 'array', items: { type: 'string' } },
      },
      required: ['declarationName', 'leanStatement', 'plainEnglish', 'assumptions'],
    }, null, 2), 'utf8');
    const codex = process.env.CODEX_BIN || process.env.ARCHON_CODEX_BIN || 'codex';
    const feedbackText = feedback ? ` The user declined the previous proposal with this feedback: ${feedback}` : '';
    const prompt = `Read ${job.referencePath} and propose the exact main Lean theorem signature. Return JSON matching the schema. leanStatement must begin with theorem or lemma and contain only the declaration through its proposition: no :=, no proof, no sorry, no markdown fence. Use Mathlib notation and preserve every hypothesis and quantifier.${feedbackText}`;
    const code = await runCommand(paths, job, codex, [
      'exec', '-C', paths.projectPath, '-m', 'gpt-5.6-sol',
      '--config', 'model_reasoning_effort="high"', '--sandbox', 'read-only',
      '--output-schema', schemaPath, '-o', outputPath, prompt,
    ]);
    if (code !== 0 || !fs.existsSync(outputPath)) throw new Error('Codex could not propose a Lean statement');
    const raw = JSON.parse(fs.readFileSync(outputPath, 'utf8')) as Omit<LeanProposal, 'leanFile' | 'compileOk' | 'compileOutput'>;
    const leanStatement = cleanStatement(raw.leanStatement || '');
    const match = leanStatement.match(DECL_RE);
    if (!match) throw new Error('Proposal does not contain a theorem or lemma declaration');
    const declarationName = match[1];
    if (raw.declarationName !== declarationName) throw new Error('Proposal declaration name mismatch');
    job.proposal = {
      declarationName,
      leanStatement,
      plainEnglish: String(raw.plainEnglish || ''),
      assumptions: Array.isArray(raw.assumptions) ? raw.assumptions.map(String) : [],
      leanFile: `TheoremProver/${toPascal(job.slug)}.lean`,
      compileOk: false,
      compileOutput: '',
    };
    await validateProposal(paths, job);
    job.proposalHash = sha256(JSON.stringify(job.proposal));
    job.state = 'AWAITING_LEAN_CONFIRMATION';
    writeJob(paths, job);
  } catch (err) {
    setFailed(paths, job, err instanceof Error ? err.message : String(err));
  }
}

async function runRethlas(paths: ProjectPaths, job: WorkflowJob): Promise<void> {
  try {
    assertRequestLocked(paths, job);
    const dataPath = path.join(paths.projectPath, 'rethlas', 'agents', 'generation', 'data', `${job.slug}.md`);
    const resultsDir = path.join(paths.projectPath, 'rethlas', 'agents', 'generation', 'results', job.slug);
    if (fs.existsSync(resultsDir)) throw new Error(`Rethlas result '${job.slug}' already exists`);
    fs.copyFileSync(path.join(jobDir(paths, job.id), 'request.md'), dataPath);
    fs.chmodSync(dataPath, 0o444);
    const code = await runCommand(paths, job, bin(paths, 'rethlas'), [`data/${job.slug}.md`, String(job.maxIterations)]);
    if (isCancelled(paths, job)) return;
    assertRequestLocked(paths, job);
    if (code !== 0) throw new Error(`Rethlas stopped with exit code ${code}`);
    const verified = path.join(resultsDir, 'blueprint_verified.md');
    if (!fs.existsSync(verified)) throw new Error('Rethlas did not produce a verified blueprint');
    const importCode = await runCommand(paths, job, bin(paths, 'import-rethlas'), [job.slug]);
    if (isCancelled(paths, job)) return;
    if (importCode !== 0) throw new Error(`Blueprint import stopped with exit code ${importCode}`);
    job.referencePath = `references/rethlas-${job.slug.replace(/[^A-Za-z0-9._-]/g, '-')}-blueprint-verified.md`;
    writeJob(paths, job);
    await proposeLean(paths, job);
  } catch (err) {
    setFailed(paths, job, err instanceof Error ? err.message : String(err));
  }
}

async function runArchon(paths: ProjectPaths, job: WorkflowJob): Promise<void> {
  try {
    job.state = 'ARCHON_RUNNING';
    job.error = undefined;
    writeJob(paths, job);
    const code = await runCommand(paths, job, bin(paths, 'archon'), [
      'loop', '.', '--no-dashboard', '--serial', '--max-iterations', String(job.maxIterations),
    ]);
    if (isCancelled(paths, job)) return;
    appendLog(paths, job.id, `\nArchon loop exit code: ${code}\n`);
    const doctor = await runCommand(paths, job, bin(paths, 'doctor'), []);
    job.state = doctor === 0 ? 'LEAN_VERIFIED' : 'NEEDS_ATTENTION';
    if (doctor !== 0) job.error = 'Archon stopped before all Lean checks passed. Review the log, then retry.';
    writeJob(paths, job);
  } catch (err) {
    setFailed(paths, job, err instanceof Error ? err.message : String(err));
  }
}

export function register(fastify: FastifyInstance, _paths: ProjectPaths) {
  fastify.get('/api/workflow/jobs', async req => listJobs(req.paths).map(job => publicJob(req.paths, job)));

  fastify.get('/api/workflow/jobs/:id', async (req, reply) => {
    try { return publicJob(req.paths, readJob(req.paths, (req.params as { id: string }).id)); }
    catch { return reply.status(404).send({ error: 'Job not found' }); }
  });

  fastify.post('/api/workflow/drafts', async (req, reply) => {
    if (!sameOrigin(req)) return reply.status(403).send({ error: 'Cross-origin request rejected' });
    const body = req.body as { slug?: string; title?: string; markdown?: string; maxIterations?: number };
    const slug = String(body?.slug || '').trim();
    const title = String(body?.title || '').trim();
    const markdown = String(body?.markdown || '').trim() + '\n';
    const maxIterations = Number(body?.maxIterations || 2);
    if (!SLUG_RE.test(slug)) return reply.status(400).send({ error: 'Slug must be 2–64 lowercase letters, digits, _ or -' });
    if (!title || title.length > 160) return reply.status(400).send({ error: 'Title is required (max 160 characters)' });
    if (markdown.length < 20 || markdown.length > 100000) return reply.status(400).send({ error: 'Markdown must be 20–100,000 characters' });
    if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 10) return reply.status(400).send({ error: 'Iterations must be between 1 and 10' });
    if (listJobs(req.paths).some(job => job.slug === slug)) return reply.status(409).send({ error: 'That slug already has a workflow job' });
    const id = `${slug}-${Date.now().toString(36)}`;
    const createdAt = new Date().toISOString();
    const job: WorkflowJob = { id, slug, title, state: 'AWAITING_REQUEST_CONFIRMATION', maxIterations, requestHash: sha256(markdown), createdAt, updatedAt: createdAt };
    fs.mkdirSync(jobDir(req.paths, id), { recursive: true });
    fs.writeFileSync(path.join(jobDir(req.paths, id), 'request.md'), markdown, { encoding: 'utf8', mode: 0o600 });
    appendLog(req.paths, id, `Created draft ${id}. Awaiting request confirmation.\n`);
    writeJob(req.paths, job);
    return reply.status(201).send(publicJob(req.paths, job));
  });

  fastify.post('/api/workflow/jobs/:id/confirm-request', async (req, reply) => {
    if (!sameOrigin(req)) return reply.status(403).send({ error: 'Cross-origin request rejected' });
    const id = (req.params as { id: string }).id;
    const job = readJob(req.paths, id);
    const body = req.body as { requestHash?: string };
    if (job.state !== 'AWAITING_REQUEST_CONFIRMATION') return reply.status(409).send({ error: 'Request is not awaiting confirmation' });
    const conflicting = listJobs(req.paths).find(other => other.id !== job.id && !['AWAITING_REQUEST_CONFIRMATION', 'LEAN_VERIFIED', 'FAILED', 'CANCELLED'].includes(other.state));
    if (conflicting) return reply.status(409).send({ error: `Another workflow is at '${conflicting.state}'. Finish or cancel it first.` });
    if (body?.requestHash !== job.requestHash) return reply.status(409).send({ error: 'Request changed; review it again' });
    fs.chmodSync(path.join(jobDir(req.paths, id), 'request.md'), 0o444);
    job.state = 'RETHLAS_RUNNING';
    writeJob(req.paths, job);
    void runRethlas(req.paths, job);
    return publicJob(req.paths, job);
  });

  fastify.post('/api/workflow/jobs/:id/confirm-lean', async (req, reply) => {
    if (!sameOrigin(req)) return reply.status(403).send({ error: 'Cross-origin request rejected' });
    const job = readJob(req.paths, (req.params as { id: string }).id);
    const body = req.body as { proposalHash?: string };
    if (job.state !== 'AWAITING_LEAN_CONFIRMATION' || !job.proposal) return reply.status(409).send({ error: 'Lean statement is not awaiting confirmation' });
    if (body?.proposalHash !== job.proposalHash) return reply.status(409).send({ error: 'Lean proposal changed; review it again' });
    const target = path.join(req.paths.projectPath, job.proposal.leanFile);
    if (fs.existsSync(target)) return reply.status(409).send({ error: `Lean file already exists: ${job.proposal.leanFile}` });
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `import Mathlib\n\n/-! Confirmed through the local proof workflow. -/\n\n${job.proposal.leanStatement} := by\n  sorry\n`, 'utf8');
    addProtection(req.paths.projectPath, job.proposal.leanFile, job.proposal.declarationName);
    job.leanFile = job.proposal.leanFile;
    job.declarationName = job.proposal.declarationName;
    registerObjective(req.paths, job);
    writeJob(req.paths, job);
    void runArchon(req.paths, job);
    return publicJob(req.paths, job);
  });

  fastify.post('/api/workflow/jobs/:id/decline-lean', async (req, reply) => {
    if (!sameOrigin(req)) return reply.status(403).send({ error: 'Cross-origin request rejected' });
    const job = readJob(req.paths, (req.params as { id: string }).id);
    const feedback = String((req.body as { feedback?: string })?.feedback || '').trim();
    if (job.state !== 'AWAITING_LEAN_CONFIRMATION') return reply.status(409).send({ error: 'Lean statement is not awaiting confirmation' });
    if (feedback.length < 3 || feedback.length > 4000) return reply.status(400).send({ error: 'Explain what needs changing (3–4,000 characters)' });
    job.feedback = feedback;
    writeJob(req.paths, job);
    void proposeLean(req.paths, job, feedback);
    return publicJob(req.paths, job);
  });

  fastify.post('/api/workflow/jobs/:id/explain-blueprint', async (req, reply) => {
    if (!sameOrigin(req)) return reply.status(403).send({ error: 'Cross-origin request rejected' });
    const job = readJob(req.paths, (req.params as { id: string }).id);
    const focus = String((req.body as { focus?: string })?.focus || '').trim();
    if (focus.length > 2000) return reply.status(400).send({ error: 'Explanation focus must be at most 2,000 characters' });
    try { verifiedReferencePath(req.paths, job); }
    catch (err) { return reply.status(409).send({ error: err instanceof Error ? err.message : String(err) }); }
    if (explanationActive.has(job.id)) return reply.status(409).send({ error: 'A detailed explanation is already being generated' });
    void explainBlueprint(req.paths, job, focus);
    return publicJob(req.paths, job);
  });

  fastify.post('/api/workflow/jobs/:id/retry', async (req, reply) => {
    if (!sameOrigin(req)) return reply.status(403).send({ error: 'Cross-origin request rejected' });
    const job = readJob(req.paths, (req.params as { id: string }).id);
    if (active.has(job.id)) return reply.status(409).send({ error: 'Job is already running' });
    if (job.state === 'NEEDS_ATTENTION' && job.leanFile) void runArchon(req.paths, job);
    else if (job.state === 'FAILED' && job.proposal && job.error === 'Proposed Lean statement did not compile') void retryProposalValidation(req.paths, job);
    else if (job.referencePath) void proposeLean(req.paths, job, job.feedback || '');
    else return reply.status(409).send({ error: 'This job cannot be retried from its current checkpoint' });
    return publicJob(req.paths, job);
  });

  fastify.post('/api/workflow/jobs/:id/cancel', async (req, reply) => {
    if (!sameOrigin(req)) return reply.status(403).send({ error: 'Cross-origin request rejected' });
    const job = readJob(req.paths, (req.params as { id: string }).id);
    const child = active.get(job.id);
    if (!child?.pid) return reply.status(409).send({ error: 'Job is not running' });
    terminateProcess(child);
    active.delete(job.id);
    job.state = 'CANCELLED';
    job.error = 'Cancelled by user';
    writeJob(req.paths, job);
    return publicJob(req.paths, job);
  });
}
