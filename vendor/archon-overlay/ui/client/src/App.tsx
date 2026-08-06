import { useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useProject, useScope, useSystemStatus, useWorkflowJobs } from './hooks/useApi';
import Overview from './views/Overview';
import LogViewer from './views/LogViewer';
import Journal from './views/Journal';
import DiffPlayback from './views/DiffPlayback';
import DagView from './views/DagView';
import Blueprint from './views/Blueprint';
import CodeView from './views/CodeView';
import ScopeHome from './views/ScopeHome';
import NewProof from './views/NewProof';
import History from './views/History';
import { ProjectSwitcher } from './components/ProjectSwitcher';
import { isStaticDashboard } from './lib/staticMode';
import { isStaticScope } from './lib/projectScope';
// Vite's resolveJsonModule (enabled by default) lets us import the
// version from package.json so the badge stays in sync with releases
// without manual updates. If you move package.json or the build setup
// changes, adjust this import path.
import { version as APP_VERSION } from '../../package.json';

function ConnectionBanner({ isError }: { isError: boolean }) {
  if (isStaticDashboard()) return null;
  if (!isError) return null;
  return (
    <div style={{
      background: '#dc2626', color: 'white', padding: '6px 16px',
      fontSize: '13px', textAlign: 'center', fontWeight: 500,
    }}>
      ⚠ Cannot reach server — check that <code style={{ background: 'rgba(0,0,0,0.2)', padding: '1px 4px', borderRadius: 3 }}>
      archon dashboard &lt;project&gt;</code> is running and you're on the correct port
    </div>
  );
}

export default function App() {
  const { data: project, isError } = useProject();
  const { data: scope, isLoading: scopeLoading } = useScope();
  const isStatic = isStaticDashboard();
  const { data: workflowJobs = [] } = useWorkflowJobs(!isStatic);
  const { data: systemStatus, refetch: refetchSystemStatus } = useSystemStatus(!isStatic);
  const [systemMessage, setSystemMessage] = useState('');
  const [systemError, setSystemError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [shuttingDown, setShuttingDown] = useState(false);
  const staticScope = isStaticScope();
  const inScopeMode = !!scope?.inScope;
  const showScopeHome = inScopeMode;
  const showCode = isStatic;
  // In live mode the project switcher always shows. In static mode it only
  // shows when the snapshot was built for a scope (and thus has per-member
  // JSON files behind the switcher).
  const showProjectSwitcher = !isStatic || staticScope;
  const workflowJob = workflowJobs.find(job => job.active)
    || workflowJobs.find(job => ['AWAITING_REQUEST_CONFIRMATION', 'AWAITING_LEAN_CONFIRMATION', 'NEEDS_ATTENTION'].includes(job.state));
  const workflowLabel = workflowJob?.state === 'AWAITING_REQUEST_CONFIRMATION'
    ? 'Request confirmation needed'
    : workflowJob?.state === 'AWAITING_LEAN_CONFIRMATION'
      ? 'Lean statement confirmation needed'
      : workflowJob?.state === 'NEEDS_ATTENTION'
        ? 'Proof workflow needs attention'
        : workflowJob ? workflowJob.state.toLowerCase().replace(/_/g, ' ') : '';

  const loginCodex = async () => {
    setLoginBusy(true);
    setSystemError('');
    try {
      const response = await fetch('/api/system/codex-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const body = await response.json().catch(() => ({})) as { error?: string; started?: boolean; codexLoggedIn?: boolean };
      if (!response.ok) throw new Error(body.error || `Login request failed (${response.status})`);
      setSystemMessage(body.codexLoggedIn ? 'Codex is already connected.' : 'Codex login opened. Finish authentication in the browser.');
      await refetchSystemStatus();
    } catch (err) {
      setSystemError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoginBusy(false);
    }
  };

  const shutdown = async () => {
    const activeWarning = workflowJobs.some(job => job.active || job.explanationActive)
      ? '\n\nA theorem run or explanation is active and will stop with the dashboard.'
      : '';
    if (!window.confirm(`Shut down the local TheoremProver dashboard?${activeWarning}`)) return;
    setSystemError('');
    try {
      const response = await fetch('/api/system/shutdown', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || `Shutdown failed (${response.status})`);
      }
      setShuttingDown(true);
    } catch (err) {
      setSystemError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="app">
      <ConnectionBanner isError={isError} />
      <header className="header">
        <h1>Archon</h1>
        <span className="version-badge" title={`Archon dashboard v${APP_VERSION}`}>
          v{APP_VERSION}
        </span>
        {project && <span className="project-badge" title={project.path}>{project.name}</span>}
        {isStatic && <span className="project-badge" title={window.__ARCHON_STATIC__?.generatedAt}>static</span>}
        {showProjectSwitcher && <ProjectSwitcher />}
        <nav className="header-nav">
          {!isStatic && <NavLink to="/new-theorem" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>New Theorem</NavLink>}
          {!isStatic && <NavLink to="/history" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>History</NavLink>}
          <NavLink to="/dag" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>DAG</NavLink>
          <NavLink to="/blueprint" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Blueprint</NavLink>
          <NavLink to="/overview" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Overview</NavLink>
          {showScopeHome && (
            <NavLink to="/scope" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Scope Home
            </NavLink>
          )}
          {showCode && <NavLink to="/code" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Code</NavLink>}
          {!isStatic && <NavLink to="/logs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Logs</NavLink>}
          {!isStatic && <NavLink to="/diffs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Diffs</NavLink>}
          <NavLink to="/journal" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Journal</NavLink>
        </nav>
        {!isStatic && <div className="header-actions">
          {!systemStatus
            ? <span className="codex-checking">Checking Codex…</span>
            : systemStatus.codexLoggedIn
              ? <span className="codex-connected"><i />Codex connected</span>
              : <button className="codex-login" disabled={loginBusy || systemStatus.codexLoginActive} onClick={() => void loginCodex()}>
                  {systemStatus.codexLoginActive ? 'Login in progress…' : loginBusy ? 'Opening login…' : 'Log in to Codex'}
                </button>}
          <button className="shutdown-button" onClick={() => void shutdown()}>Shut down</button>
        </div>}
      </header>
      {systemMessage && <div className="system-message">{systemMessage}<button onClick={() => setSystemMessage('')}>×</button></div>}
      {systemError && <div className="system-message system-error">{systemError}<button onClick={() => setSystemError('')}>×</button></div>}
      {workflowJob && <NavLink to="/new-theorem" className="workflow-global-banner">
        <span className="workflow-global-dot" />
        <strong>{workflowJob.title}</strong>
        <span>{workflowLabel}</span>
        <b>Open Proof Studio →</b>
      </NavLink>}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to={isStatic ? '/overview' : '/new-theorem'} replace />} />
          {/* Overview remains explicit even though New Theorem is the live
              dashboard landing page. */}
          <Route path="/overview" element={<Overview />} />
          <Route path="/new-theorem" element={isStatic ? <Navigate to="/overview" replace /> : <NewProof />} />
          <Route path="/new-proof" element={<Navigate to={isStatic ? '/overview' : '/new-theorem'} replace />} />
          <Route path="/history" element={isStatic ? <Navigate to="/overview" replace /> : <History />} />
          {/* The old proof-graph view is superseded by the DAG. */}
          <Route path="/graph" element={<Navigate to="/dag" replace />} />
          <Route path="/dag" element={<DagView />} />
          <Route path="/blueprint" element={<Blueprint />} />
          <Route path="/code" element={showCode ? <CodeView /> : <Navigate to="/diffs" replace />} />
          {/* Don't redirect off Scope Home until useScope() has resolved:
              on a refresh or the reload() after switching projects, `scope`
              is undefined on first render, so a premature <Navigate to="/">
              would bounce the user to Overview. Hold on a null element while
              the query is in flight. */}
          <Route path="/scope" element={showScopeHome ? <ScopeHome /> : scopeLoading ? null : <Navigate to="/" replace />} />
          <Route path="/logs" element={isStatic ? <Navigate to="/" replace /> : <LogViewer />} />
          <Route path="/diffs" element={isStatic ? <Navigate to="/" replace /> : <DiffPlayback />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="*" element={<Navigate to={isStatic ? '/overview' : '/new-theorem'} replace />} />
        </Routes>
      </main>
      {shuttingDown && <div className="shutdown-screen"><div><span>✓</span><h2>TheoremProver has shut down</h2><p>You can close this browser tab. Run <code>./bin/start</code> to open it again.</p></div></div>}
    </div>
  );
}
