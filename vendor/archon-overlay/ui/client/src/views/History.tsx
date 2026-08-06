import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MarkdownBlock from '../components/MarkdownBlock';
import { useWorkflowJobs } from '../hooks/useApi';
import { WORKFLOW_LABELS, type WorkflowJob, type WorkflowState } from '../lib/workflow';
import styles from './History.module.css';

type Artifact = 'request' | 'blueprint' | 'explanation' | 'lean';
type Filter = 'all' | 'active' | 'verified' | 'attention';

function statusTone(state: WorkflowState): string {
  if (state === 'LEAN_VERIFIED') return styles.verified;
  if (state === 'FAILED' || state === 'NEEDS_ATTENTION' || state === 'CANCELLED') return styles.attention;
  if (state === 'RETHLAS_RUNNING' || state === 'PROPOSING_LEAN' || state === 'ARCHON_RUNNING') return styles.running;
  if (state === 'AWAITING_REQUEST_CONFIRMATION' || state === 'AWAITING_LEAN_CONFIRMATION') return styles.waiting;
  return styles.neutral;
}

function requestExcerpt(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' [code] ')
    .replace(/[#>*_`\[\]()~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

async function postJson(url: string): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
}

export default function History() {
  const navigate = useNavigate();
  const { data: jobs = [], isLoading, isError, refetch } = useWorkflowJobs();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [artifact, setArtifact] = useState<Artifact>('request');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [actionError, setActionError] = useState('');
  const [explainBusy, setExplainBusy] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return jobs.filter(job => {
      const matchesText = !needle || `${job.title} ${job.slug} ${job.requestMarkdown}`.toLowerCase().includes(needle);
      const matchesFilter = filter === 'all'
        || (filter === 'active' && (job.active || job.explanationActive))
        || (filter === 'verified' && job.state === 'LEAN_VERIFIED')
        || (filter === 'attention' && ['FAILED', 'NEEDS_ATTENTION', 'CANCELLED'].includes(job.state));
      return matchesText && matchesFilter;
    });
  }, [filter, jobs, query]);

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some(job => job.id === selectedId)) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const selected = jobs.find(job => job.id === selectedId) || null;
  const choose = (job: WorkflowJob) => {
    setSelectedId(job.id);
    setArtifact('request');
    setActionError('');
  };

  const generateExplanation = async () => {
    if (!selected) return;
    setExplainBusy(true);
    setActionError('');
    try {
      await postJson(`/api/workflow/jobs/${selected.id}/explain-blueprint`);
      setArtifact('explanation');
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setExplainBusy(false);
    }
  };

  const totals = {
    verified: jobs.filter(job => job.state === 'LEAN_VERIFIED').length,
    blueprints: jobs.filter(job => job.blueprintMarkdown).length,
    explanations: jobs.filter(job => job.blueprintExplanation).length,
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Proof archive</span>
          <h2>Theorem history</h2>
          <p>Every request stays paired with the artifacts produced from it.</p>
        </div>
        <div className={styles.stats}>
          <div><strong>{jobs.length}</strong><span>Requests</span></div>
          <div><strong>{totals.blueprints}</strong><span>Blueprints</span></div>
          <div><strong>{totals.explanations}</strong><span>Explanations</span></div>
          <div><strong>{totals.verified}</strong><span>Lean verified</span></div>
        </div>
      </section>

      <section className={styles.toolbar}>
        <label>
          <span>Search history</span>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search title, slug, or request…" />
        </label>
        <div className={styles.filters}>
          {(['all', 'active', 'verified', 'attention'] as Filter[]).map(value => (
            <button key={value} className={filter === value ? styles.selectedFilter : ''} onClick={() => setFilter(value)}>
              {value === 'all' ? 'All runs' : value.charAt(0).toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
      </section>

      {isError && <div className={styles.error}>Could not load theorem history.</div>}
      {actionError && <div className={styles.error}>{actionError}<button onClick={() => setActionError('')}>Dismiss</button></div>}

      <div className={styles.workspace}>
        <aside className={styles.runList} aria-label="Theorem requests">
          {isLoading && <div className={styles.empty}>Loading requests…</div>}
          {!isLoading && filtered.length === 0 && <div className={styles.empty}>No requests match this view.</div>}
          {filtered.map(job => (
            <button key={job.id} className={`${styles.runCard} ${selectedId === job.id ? styles.selectedRun : ''}`} onClick={() => choose(job)}>
              <div className={styles.runTop}>
                <span className={`${styles.status} ${statusTone(job.state)}`}>{WORKFLOW_LABELS[job.state]}</span>
                <time>{new Date(job.createdAt).toLocaleDateString()}</time>
              </div>
              <h3>{job.title}</h3>
              <code>{job.slug}</code>
              <p>{requestExcerpt(job.requestMarkdown) || 'Empty request'}</p>
              <div className={styles.artifactPills}>
                <span className={styles.available}>Request</span>
                <span className={job.blueprintMarkdown ? styles.available : ''}>Blueprint</span>
                <span className={job.blueprintExplanation ? styles.available : ''}>Explanation</span>
                <span className={job.proposal ? styles.available : ''}>Lean</span>
              </div>
            </button>
          ))}
        </aside>

        <section className={styles.detail}>
          {!selected && <div className={styles.detailEmpty}>Select a request to inspect its complete history.</div>}
          {selected && <>
            <header className={styles.detailHeader}>
              <div>
                <span className={styles.eyebrow}>Run details</span>
                <h2>{selected.title}</h2>
                <div className={styles.detailMeta}>
                  <code>{selected.id}</code>
                  <span>Created {new Date(selected.createdAt).toLocaleString()}</span>
                  <span>Updated {new Date(selected.updatedAt).toLocaleString()}</span>
                </div>
              </div>
              <div className={styles.detailActions}>
                <span className={`${styles.status} ${statusTone(selected.state)}`}>{WORKFLOW_LABELS[selected.state]}</span>
                <button onClick={() => navigate(`/new-theorem?rerun=${encodeURIComponent(selected.id)}`)}>Edit &amp; rerun</button>
              </div>
            </header>

            <nav className={styles.artifactTabs} aria-label="Run artifacts">
              <button className={artifact === 'request' ? styles.activeTab : ''} onClick={() => setArtifact('request')}>Request</button>
              <button className={artifact === 'blueprint' ? styles.activeTab : ''} onClick={() => setArtifact('blueprint')}>
                Blueprint {selected.blueprintMarkdown && <b>✓</b>}
              </button>
              <button className={artifact === 'explanation' ? styles.activeTab : ''} onClick={() => setArtifact('explanation')}>
                Explanation {selected.blueprintExplanation && <b>✓</b>}
              </button>
              <button className={artifact === 'lean' ? styles.activeTab : ''} onClick={() => setArtifact('lean')}>
                Lean statement {selected.proposal && <b>✓</b>}
              </button>
            </nav>

            <div className={styles.artifactDocument}>
              {artifact === 'request' && <>
                <div className={styles.documentMeta}><span>Immutable submitted request</span><code>SHA-256 {selected.requestHash}</code></div>
                <MarkdownBlock content={selected.requestMarkdown} />
              </>}

              {artifact === 'blueprint' && (selected.blueprintMarkdown
                ? <><div className={styles.documentMeta}><span>Verified proof blueprint</span><code>{selected.referencePath}</code></div><MarkdownBlock content={selected.blueprintMarkdown} /></>
                : <ArtifactEmpty title="Blueprint not available yet" text="The verified blueprint appears here after the Rethlas generation and verification stage finishes." />)}

              {artifact === 'explanation' && (selected.blueprintExplanation
                ? <><div className={styles.documentMeta}><span>Detailed human-readable explanation</span>{selected.explanationUpdatedAt && <span>{new Date(selected.explanationUpdatedAt).toLocaleString()}</span>}</div><MarkdownBlock content={selected.blueprintExplanation} /></>
                : <ArtifactEmpty
                    title={selected.explanationActive ? 'Explanation is being written…' : 'No detailed explanation yet'}
                    text={selected.blueprintMarkdown ? 'Generate an expanded, step-by-step explanation from this verified blueprint.' : 'An explanation can be generated after the blueprint is verified.'}
                    action={selected.blueprintMarkdown && !selected.explanationActive
                      ? <button disabled={explainBusy} onClick={() => void generateExplanation()}>{explainBusy ? 'Starting…' : 'Generate explanation'}</button>
                      : undefined}
                  />)}

              {artifact === 'lean' && (selected.proposal
                ? <>
                    <div className={styles.documentMeta}><span>{selected.proposal.plainEnglish}</span><code>{selected.proposal.leanFile}</code></div>
                    {selected.proposal.assumptions.length > 0 && <div className={styles.assumptions}><strong>Assumptions</strong><ul>{selected.proposal.assumptions.map(item => <li key={item}>{item}</li>)}</ul></div>}
                    <pre className={styles.leanCode}><code>{selected.proposal.leanStatement}</code></pre>
                  </>
                : <ArtifactEmpty title="Lean statement not available yet" text="The proposed statement appears here once the verified blueprint has been translated and compile-checked." />)}
            </div>
          </>}
        </section>
      </div>
    </div>
  );
}

function ArtifactEmpty({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return <div className={styles.artifactEmpty}><div>◇</div><h3>{title}</h3><p>{text}</p>{action}</div>;
}
