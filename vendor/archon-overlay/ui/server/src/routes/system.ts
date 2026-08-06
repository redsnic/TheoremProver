/** Local dashboard lifecycle and Codex authentication controls. */
import { spawn, spawnSync, type ChildProcess } from 'child_process';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ProjectPaths } from './project.js';
import { stopWorkflowProcesses } from './workflow.js';

let codexLoginProcess: ChildProcess | null = null;

function sameOrigin(req: FastifyRequest): boolean {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

function codexBinary(): string {
  return process.env.CODEX_BIN || process.env.ARCHON_CODEX_BIN || 'codex';
}

function codexLoggedIn(): boolean {
  const result = spawnSync(codexBinary(), ['login', 'status'], {
    env: process.env,
    stdio: 'ignore',
    timeout: 8000,
  });
  return !result.error && result.status === 0;
}

export function register(fastify: FastifyInstance, _paths: ProjectPaths) {
  fastify.get('/api/system/status', async () => ({
    codexLoggedIn: codexLoggedIn(),
    codexLoginActive: codexLoginProcess !== null,
  }));

  fastify.post('/api/system/codex-login', async (req, reply) => {
    if (!sameOrigin(req)) return reply.status(403).send({ error: 'Cross-origin request rejected' });
    if (codexLoggedIn()) return { started: false, codexLoggedIn: true };
    if (codexLoginProcess) return reply.status(409).send({ error: 'Codex login is already running' });

    try {
      const child = spawn(codexBinary(), ['login'], {
        cwd: req.paths.projectPath,
        env: process.env,
        stdio: 'inherit',
      });
      codexLoginProcess = child;
      const clear = () => { if (codexLoginProcess === child) codexLoginProcess = null; };
      child.once('error', clear);
      child.once('close', clear);
      return reply.status(202).send({ started: true, codexLoggedIn: false });
    } catch (err) {
      codexLoginProcess = null;
      return reply.status(500).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  fastify.post('/api/system/shutdown', async (req, reply) => {
    if (!sameOrigin(req)) return reply.status(403).send({ error: 'Cross-origin request rejected' });
    stopWorkflowProcesses();
    codexLoginProcess?.kill('SIGTERM');
    await reply.send({ shuttingDown: true });
    const timer = setTimeout(async () => {
      try { await fastify.close(); } finally { process.exit(0); }
    }, 500);
    timer.unref();
  });
}
