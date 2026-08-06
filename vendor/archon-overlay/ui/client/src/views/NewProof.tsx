import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import MarkdownBlock from '../components/MarkdownBlock';
import { highlightLeanLines } from '../utils/leanHighlight';
import { WORKFLOW_LABELS as LABELS, type WorkflowJob as Job, type WorkflowState } from '../lib/workflow';
import styles from './NewProof.module.css';

const PIPELINE = [
  'Request locked', 'Blueprint verified', 'Lean statement approved', 'Archon proof', 'Lean checks',
];

function completedSteps(state: WorkflowState): number {
  if (state === 'AWAITING_REQUEST_CONFIRMATION') return 0;
  if (state === 'RETHLAS_RUNNING') return 1;
  if (state === 'PROPOSING_LEAN' || state === 'AWAITING_LEAN_CONFIRMATION') return 2;
  if (state === 'ARCHON_RUNNING' || state === 'NEEDS_ATTENTION') return 3;
  if (state === 'LEAN_VERIFIED') return 5;
  return 0;
}

function currentStep(state: WorkflowState): number {
  if (state === 'AWAITING_REQUEST_CONFIRMATION') return 0;
  if (state === 'RETHLAS_RUNNING') return 1;
  if (state === 'PROPOSING_LEAN' || state === 'AWAITING_LEAN_CONFIRMATION') return 2;
  if (state === 'ARCHON_RUNNING' || state === 'NEEDS_ATTENTION') return 3;
  return state === 'LEAN_VERIFIED' ? 4 : 0;
}

function elapsed(createdAt: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

function rerunSlug(original: string, jobs: Job[]): string {
  const used = new Set(jobs.map(job => job.slug));
  let sequence = 1;
  while (true) {
    const suffix = sequence === 1 ? '-rerun' : `-rerun-${sequence}`;
    const candidate = `${original.slice(0, 64 - suffix.length).replace(/[-_]+$/, '')}${suffix}`;
    if (!used.has(candidate)) return candidate;
    sequence += 1;
  }
}

function LeanCode({ code }: { code: string }) {
  const lines = code.split('\n');
  const highlighted = highlightLeanLines(lines);
  return (
    <pre className={styles.leanCode}>
      {highlighted.map((tokens, line) => (
        <div className={styles.codeLine} key={line}>
          <span className={styles.lineNo}>{line + 1}</span>
          <code>{tokens.map((token, i) => <span key={i} className={token.cls ? styles[token.cls] : undefined}>{token.text}</span>)}</code>
        </div>
      ))}
    </pre>
  );
}

function formatLeanStatement(statement: string): string {
  const propositionStart = statement.lastIndexOf(' : ');
  if (propositionStart < 0) return statement;
  return `${statement.slice(0, propositionStart)} :\n  ${statement.slice(propositionStart + 3)}`;
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className={styles.backdrop} role="presentation">
      <section className={styles.modal} role="dialog" aria-modal="true">
        {onClose && <button className={styles.close} onClick={onClose} aria-label="Close">×</button>}
        {children}
      </section>
    </div>
  );
}

export default function NewProof() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [markdown, setMarkdown] = useState('# Problem\n\n');
  const [iterations, setIterations] = useState(2);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [reviewJob, setReviewJob] = useState<Job | null>(null);
  const [leanJob, setLeanJob] = useState<Job | null>(null);
  const [requestDetailJob, setRequestDetailJob] = useState<Job | null>(null);
  const [requestView, setRequestView] = useState<'preview' | 'source'>('preview');
  const [loadedFromJob, setLoadedFromJob] = useState<Job | null>(null);
  const [blueprintJob, setBlueprintJob] = useState<Job | null>(null);
  const [explanationFocus, setExplanationFocus] = useState('');
  const [explainBusy, setExplainBusy] = useState(false);
  const [declineText, setDeclineText] = useState('');
  const [showLeanChanges, setShowLeanChanges] = useState(false);
  const [copiedLean, setCopiedLean] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const autoOpenedLeanJobs = useRef(new Set<string>());
  const loadedRerunJob = useRef<string | null>(null);

  const refresh = async () => {
    try {
      const next = await api<Job[]>('/api/workflow/jobs');
      setJobs(next);
      setBlueprintJob(current => current ? next.find(job => job.id === current.id) || null : null);
      setLeanJob(current => {
        if (current) {
          const updated = next.find(job => job.id === current.id);
          if (updated?.state === 'AWAITING_LEAN_CONFIRMATION') return updated;
          return null;
        }
        const waiting = next.find(job => job.state === 'AWAITING_LEAN_CONFIRMATION');
        if (waiting && !autoOpenedLeanJobs.current.has(waiting.id)) {
          autoOpenedLeanJobs.current.add(waiting.id);
          return waiting;
        }
        return null;
      });
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 2500);
    return () => window.clearInterval(timer);
  }, []);

  const markdownPreview = useMemo(() => markdown.trim(), [markdown]);
  const focusJob = jobs.find(job => job.active)
    || jobs.find(job => job.state === 'AWAITING_REQUEST_CONFIRMATION' || job.state === 'AWAITING_LEAN_CONFIRMATION')
    || jobs.find(job => job.state === 'NEEDS_ATTENTION')
    || jobs[0];

  const updateTitle = (value: string) => {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const createDraft = async () => {
    setBusy(true); setError('');
    try {
      const job = await api<Job>('/api/workflow/drafts', {
        method: 'POST', body: JSON.stringify({ title, slug, markdown, maxIterations: iterations }),
      });
      setReviewJob(job);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };

  const confirmRequest = async () => {
    if (!reviewJob) return;
    setBusy(true); setError('');
    try {
      await api(`/api/workflow/jobs/${reviewJob.id}/confirm-request`, {
        method: 'POST', body: JSON.stringify({ requestHash: reviewJob.requestHash }),
      });
      setReviewJob(null); setLoadedFromJob(null); setTitle(''); setSlug(''); setSlugTouched(false); setMarkdown('# Problem\n\n');
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };

  const confirmLean = async () => {
    if (!leanJob?.proposalHash) return;
    setBusy(true); setError('');
    try {
      await api(`/api/workflow/jobs/${leanJob.id}/confirm-lean`, {
        method: 'POST', body: JSON.stringify({ proposalHash: leanJob.proposalHash }),
      });
      setLeanJob(null); setDeclineText(''); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };

  const declineLean = async () => {
    if (!leanJob) return;
    setBusy(true); setError('');
    try {
      await api(`/api/workflow/jobs/${leanJob.id}/decline-lean`, {
        method: 'POST', body: JSON.stringify({ feedback: declineText }),
      });
      setLeanJob(null); setDeclineText(''); setShowLeanChanges(false); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };

  const copyLean = async () => {
    if (!leanJob?.proposal) return;
    await navigator.clipboard.writeText(leanJob.proposal.leanStatement);
    setCopiedLean(true);
    window.setTimeout(() => setCopiedLean(false), 1600);
  };

  const closeLeanReview = () => {
    if (busy) return;
    setLeanJob(null);
    setDeclineText('');
    setShowLeanChanges(false);
  };

  const viewRequest = (job: Job) => {
    setLeanJob(null);
    setRequestView('preview');
    setRequestDetailJob(job);
  };

  const loadRequestForRerun = (job: Job) => {
    setTitle(job.title);
    setSlug(rerunSlug(job.slug, jobs));
    setSlugTouched(true);
    setMarkdown(job.requestMarkdown);
    setIterations(job.maxIterations);
    setLoadedFromJob(job);
    setRequestDetailJob(null);
    setLeanJob(null);
    window.requestAnimationFrame(() => document.getElementById('proof-request-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  useEffect(() => {
    const rerunId = searchParams.get('rerun');
    if (!rerunId || loadedRerunJob.current === rerunId || jobs.length === 0) return;
    const sourceJob = jobs.find(job => job.id === rerunId);
    if (!sourceJob) return;
    loadedRerunJob.current = rerunId;
    loadRequestForRerun(sourceJob);
    setSearchParams({}, { replace: true });
  }, [jobs, searchParams, setSearchParams]);

  const openExplanation = (job: Job) => {
    setLeanJob(null);
    setExplanationFocus('');
    setBlueprintJob(job);
  };

  const generateExplanation = async () => {
    if (!blueprintJob) return;
    setExplainBusy(true); setError('');
    try {
      const updated = await api<Job>(`/api/workflow/jobs/${blueprintJob.id}/explain-blueprint`, {
        method: 'POST', body: JSON.stringify({ focus: explanationFocus }),
      });
      setBlueprintJob(updated);
      setExplanationFocus('');
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setExplainBusy(false); }
  };

  const jobAction = async (job: Job, action: 'retry' | 'cancel') => {
    setError('');
    try { await api(`/api/workflow/jobs/${job.id}/${action}`, { method: 'POST', body: '{}' }); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div><span className={styles.eyebrow}>New Theorem</span><h2>From a mathematical request to checked Lean</h2></div>
        <p>Submit the idea once. The system pauses only when your mathematical intent needs confirmation.</p>
      </section>

      {error && <div className={styles.error}>{error}<button onClick={() => setError('')}>Dismiss</button></div>}

      {focusJob && <section className={`${styles.progressFocus} ${(focusJob.state === 'AWAITING_REQUEST_CONFIRMATION' || focusJob.state === 'AWAITING_LEAN_CONFIRMATION' || focusJob.state === 'NEEDS_ATTENTION') ? styles.progressAttention : ''}`}>
        <div className={styles.progressHeadline}>
          <div>
            <span className={styles.liveDot} />
            <span className={styles.eyebrow}>{focusJob.active ? 'Live progress' : 'Current checkpoint'}</span>
            <h3>{LABELS[focusJob.state]}</h3>
            <p><strong>{focusJob.title}</strong> · elapsed {elapsed(focusJob.createdAt)}</p>
          </div>
          <div className={styles.progressCta}>
            {focusJob.state === 'AWAITING_REQUEST_CONFIRMATION' && <><span>Waiting for you</span><button onClick={() => setReviewJob(focusJob)}>Review request</button></>}
            {focusJob.state === 'AWAITING_LEAN_CONFIRMATION' && <><span>Waiting for you</span><button onClick={() => setLeanJob(focusJob)}>Review Lean statement</button></>}
            {focusJob.state === 'NEEDS_ATTENTION' && <><span>Action needed</span><button onClick={() => void jobAction(focusJob, 'retry')}>Retry checkpoint</button></>}
            {focusJob.active && <span className={styles.runningPill}>Agents working</span>}
          </div>
        </div>
        <div className={styles.bigTimeline}>
          {PIPELINE.map((item, i) => {
            const step = currentStep(focusJob.state);
            const state = focusJob.state === 'LEAN_VERIFIED' || i < step ? 'done' : i === step ? 'current' : 'pending';
            return <div className={styles[state]} key={item}><span>{state === 'done' ? '✓' : i + 1}</span><p>{item}</p></div>;
          })}
        </div>
      </section>}

      <div className={styles.layout}>
        <section className={styles.card} id="proof-request-editor">
          <div className={styles.cardHeader}><div><span className={styles.step}>01</span><h3>Describe the proof</h3></div><span className={styles.localBadge}>Local only</span></div>
          {loadedFromJob && <div className={styles.loadedBanner}>
            <div><span>Loaded from previous run</span><strong>{loadedFromJob.title}</strong><code>{loadedFromJob.id}</code></div>
            <button onClick={() => { setLoadedFromJob(null); setTitle(''); setSlug(''); setSlugTouched(false); setMarkdown('# Problem\n\n'); setIterations(2); }}>Clear</button>
          </div>}
          <label>Title<input value={title} onChange={e => updateTitle(e.target.value)} placeholder="Binomial square identity" /></label>
          <div className={styles.row}>
            <label>Job slug<input value={slug} onChange={e => { setSlugTouched(true); setSlug(slugify(e.target.value)); }} placeholder="binomial-square" /></label>
            <label>Max iterations<input type="number" min={1} max={10} value={iterations} onChange={e => setIterations(Number(e.target.value))} /></label>
          </div>
          <label>Problem in Markdown<textarea className={styles.editor} value={markdown} onChange={e => setMarkdown(e.target.value)} spellCheck /></label>
          <div className={styles.preview}><span>Preview</span><MarkdownBlock content={markdownPreview} /></div>
          <div className={styles.formFooter}><p>You will review an immutable copy before any agents run.</p><button className={styles.primary} disabled={busy || !title || !slug || markdown.trim().length < 20} onClick={createDraft}>Review request →</button></div>
        </section>

        <aside className={styles.card}>
          <div className={styles.cardHeader}><div><span className={styles.step}>02</span><h3>Workflow runs</h3></div></div>
          <div className={styles.pipeline}>
            {PIPELINE.map((item, i) => <div key={item}><span>{i + 1}</span><p>{item}</p></div>)}
          </div>
          <p className={styles.note}>The two locks protect the original Markdown and the exact Lean signature. Proof agents may change proof bodies, never your confirmed theorem.</p>
        </aside>
      </div>

      <section className={styles.jobs}>
        <div className={styles.sectionTitle}><div><span className={styles.eyebrow}>Activity</span><h3>Proof jobs</h3></div><button className={styles.secondary} onClick={() => void refresh()}>Refresh</button></div>
        {jobs.length === 0 && <div className={styles.empty}>No proof jobs yet. Your first confirmed request will appear here.</div>}
        {jobs.map(job => {
          const done = completedSteps(job.state);
          return <article className={styles.job} key={job.id}>
            <div className={styles.jobTop}>
              <div><h4>{job.title}</h4><code>{job.slug}</code></div>
              <span className={`${styles.status} ${styles[job.state]}`}>{LABELS[job.state]}</span>
            </div>
            <div className={styles.meter}><span style={{ width: `${(done / PIPELINE.length) * 100}%` }} /></div>
            <div className={styles.jobMeta}><span>Updated {new Date(job.updatedAt).toLocaleTimeString()}</span>{job.referencePath && <span>{job.referencePath}</span>}{job.leanFile && <span>{job.leanFile}</span>}</div>
            {job.error && <p className={styles.jobError}>{job.error}</p>}
            <div className={styles.jobActions}>
              {job.state === 'AWAITING_REQUEST_CONFIRMATION' && <button onClick={() => setReviewJob(job)}>Review request</button>}
              {job.state === 'AWAITING_LEAN_CONFIRMATION' && <button className={styles.primary} onClick={() => setLeanJob(job)}>Review Lean statement</button>}
              {job.active && <button className={styles.danger} onClick={() => void jobAction(job, 'cancel')}>Stop</button>}
              {(job.state === 'FAILED' || job.state === 'NEEDS_ATTENTION') && <button onClick={() => void jobAction(job, 'retry')}>Retry checkpoint</button>}
              <button onClick={() => viewRequest(job)}>View request</button>
              <button onClick={() => loadRequestForRerun(job)}>Edit &amp; rerun</button>
              {job.referencePath && <button className={styles.explainButton} onClick={() => openExplanation(job)}>{job.blueprintExplanation ? 'View explanation' : job.explanationActive ? 'Writing explanation…' : 'Explain proof'}</button>}
              <details><summary>Technical log</summary><pre className={styles.log}>{job.logTail || 'No log output yet.'}</pre></details>
            </div>
          </article>;
        })}
      </section>

      {requestDetailJob && <Modal onClose={() => setRequestDetailJob(null)}>
        <header className={styles.requestDetailHeader}>
          <div>
            <span className={styles.eyebrow}>Original run request</span>
            <h2>{requestDetailJob.title}</h2>
            <code>{requestDetailJob.id}</code>
          </div>
          <span className={`${styles.status} ${styles[requestDetailJob.state]}`}>{LABELS[requestDetailJob.state]}</span>
        </header>

        <dl className={styles.requestFacts}>
          <div><dt>Slug</dt><dd><code>{requestDetailJob.slug}</code></dd></div>
          <div><dt>Iteration budget</dt><dd>{requestDetailJob.maxIterations}</dd></div>
          <div><dt>Created</dt><dd>{new Date(requestDetailJob.createdAt).toLocaleString()}</dd></div>
          <div><dt>Last updated</dt><dd>{new Date(requestDetailJob.updatedAt).toLocaleString()}</dd></div>
          <div className={styles.hashFact}><dt>Locked request hash</dt><dd><code>{requestDetailJob.requestHash}</code></dd></div>
        </dl>

        <div className={styles.requestDocumentHeader}>
          <div><span className={styles.eyebrow}>Complete request</span><h3>Submitted Markdown</h3></div>
          <div className={styles.viewToggle}>
            <button className={requestView === 'preview' ? styles.selected : ''} onClick={() => setRequestView('preview')}>Rendered</button>
            <button className={requestView === 'source' ? styles.selected : ''} onClick={() => setRequestView('source')}>Markdown source</button>
          </div>
        </div>
        <div className={styles.requestDocument}>
          {requestView === 'preview'
            ? <MarkdownBlock content={requestDetailJob.requestMarkdown} />
            : <pre>{requestDetailJob.requestMarkdown}</pre>}
        </div>

        <footer className={styles.requestDetailActions}>
          <p>This view is immutable. Editing creates a separate run and preserves this history.</p>
          <div><button className={styles.secondary} onClick={() => setRequestDetailJob(null)}>Close</button><button className={styles.primary} onClick={() => loadRequestForRerun(requestDetailJob)}>Load into editor →</button></div>
        </footer>
      </Modal>}

      {blueprintJob && <Modal onClose={() => setBlueprintJob(null)}>
        <header className={styles.explanationHeader}>
          <div className={styles.explanationIcon}>∴</div>
          <div>
            <span className={styles.eyebrow}>Verified blueprint · explained</span>
            <h2>Step-by-step proof</h2>
            <p>{blueprintJob.title}</p>
          </div>
        </header>

        {blueprintJob.explanationActive && <div className={styles.explanationRunning}>
          <span className={styles.liveDot} />
          <div><strong>Writing a detailed explanation…</strong><p>The verified blueprint is being expanded into smaller mathematical steps. You can close this window and return later.</p></div>
        </div>}

        {blueprintJob.explanationError && <div className={styles.explanationError}><strong>Explanation could not be generated</strong><span>{blueprintJob.explanationError}</span></div>}

        {blueprintJob.blueprintExplanation
          ? <div className={styles.explanationDocument}>
              <div className={styles.explanationDocumentMeta}><span>Human-readable explanation</span>{blueprintJob.explanationUpdatedAt && <span>Generated {new Date(blueprintJob.explanationUpdatedAt).toLocaleString()}</span>}</div>
              <MarkdownBlock content={blueprintJob.blueprintExplanation} />
            </div>
          : !blueprintJob.explanationActive && <div className={styles.explanationEmpty}>
              <strong>Turn the blueprint into a guided explanation</strong>
              <p>This adds intermediate steps and explains why each move is valid. It does not change the theorem or formal proof.</p>
            </div>}

        {!blueprintJob.explanationActive && <div className={styles.explanationControls}>
          <label>{blueprintJob.blueprintExplanation ? 'Regenerate with a different focus (optional)' : 'What should the explanation focus on? (optional)'}
            <textarea value={explanationFocus} maxLength={2000} onChange={e => setExplanationFocus(e.target.value)} placeholder="For example: explain every algebraic expansion as if I am new to rings." />
          </label>
          <div><span>Generated locally through Codex from the verified blueprint.</span><button className={styles.primary} disabled={explainBusy} onClick={() => void generateExplanation()}>{explainBusy ? 'Starting…' : blueprintJob.blueprintExplanation ? 'Regenerate explanation' : 'Generate detailed explanation'}</button></div>
        </div>}
      </Modal>}

      {reviewJob && <Modal onClose={() => !busy && setReviewJob(null)}>
        <span className={styles.eyebrow}>Confirmation 1 of 2</span><h2>Lock this proof request?</h2>
        <p className={styles.modalLead}>This exact Markdown will be hashed and made read-only before Rethlas starts.</p>
        <div className={styles.lockMeta}><span>SHA-256</span><code>{reviewJob.requestHash}</code><span>Budget</span><code>{reviewJob.maxIterations} Rethlas / Archon iterations</code></div>
        <div className={styles.modalPreview}><MarkdownBlock content={reviewJob.requestMarkdown} /></div>
        <div className={styles.modalActions}><button className={styles.secondary} disabled={busy} onClick={() => setReviewJob(null)}>Decline</button><button className={styles.primary} disabled={busy} onClick={confirmRequest}>{busy ? 'Locking…' : 'Confirm, lock & run'}</button></div>
      </Modal>}

      {leanJob?.proposal && <Modal onClose={closeLeanReview}>
        <header className={styles.reviewHeader}>
          <div className={styles.reviewIcon}>λ</div>
          <div>
            <span className={styles.eyebrow}>Final checkpoint · 2 of 2</span>
            <h2>Approve the theorem to prove</h2>
            <p>{leanJob.title}</p>
          </div>
        </header>

        <div className={styles.reviewStatus}>
          <span><b>✓</b> Blueprint verified</span>
          <span><b>✓</b> Lean compiles</span>
          <span><b>🔒</b> Signature locks after approval</span>
        </div>

        <section className={styles.reviewSection}>
          <div className={styles.reviewStep}>1</div>
          <div className={styles.reviewContent}>
            <div className={styles.reviewSectionTitle}>
              <div><span>Mathematical intent</span><h3>Is this what you mean?</h3></div>
            </div>
            <p className={styles.meaning}>{leanJob.proposal.plainEnglish}</p>
            {leanJob.proposal.assumptions.length > 0 && <div className={styles.assumptionBox}>
              <span>Assumptions and scope</span>
              <ul>{leanJob.proposal.assumptions.map(item => <li key={item}>{item}</li>)}</ul>
            </div>}
          </div>
        </section>

        <section className={styles.reviewSection}>
          <div className={styles.reviewStep}>2</div>
          <div className={styles.reviewContent}>
            <div className={styles.reviewSectionTitle}>
              <div><span>Exact declaration</span><h3>Lean statement</h3></div>
              <button className={styles.copyButton} onClick={() => void copyLean()}>{copiedLean ? '✓ Copied' : 'Copy code'}</button>
            </div>
            <LeanCode code={formatLeanStatement(leanJob.proposal.leanStatement)} />
            <div className={styles.codeMeta}><code>{leanJob.proposal.leanFile}</code><span>No proof body is locked—only this signature.</span></div>
          </div>
        </section>

        {showLeanChanges && <section className={styles.changePanel}>
          <div className={styles.changePanelHeader}><div><span className={styles.eyebrow}>Request a revision</span><h3>What should change?</h3></div><button onClick={() => { setShowLeanChanges(false); setDeclineText(''); }}>Cancel</button></div>
          <p>Be specific about the types, assumptions, quantifiers, or conclusion that should be different.</p>
          <textarea autoFocus className={styles.feedback} value={declineText} onChange={e => setDeclineText(e.target.value)} placeholder="Example: State this for rational numbers ℚ instead of an arbitrary commutative ring." />
          <div className={styles.changeActions}><span>{declineText.trim().length < 3 ? 'Add a short explanation to continue.' : 'The statement will be regenerated for another review.'}</span><button className={styles.danger} disabled={busy || declineText.trim().length < 3} onClick={declineLean}>{busy ? 'Sending…' : 'Send feedback & regenerate'}</button></div>
        </section>}

        <footer className={styles.reviewActions}>
          <div><strong>Ready to continue?</strong><span>Approval starts the formal proof run.</span></div>
          <div>
            <button className={styles.secondary} disabled={busy} onClick={() => setShowLeanChanges(true)}>Request changes</button>
            <button className={styles.approveButton} disabled={busy} onClick={confirmLean}>{busy ? 'Starting proof…' : 'Approve theorem & start proof'}<span>→</span></button>
          </div>
        </footer>
      </Modal>}
    </div>
  );
}
