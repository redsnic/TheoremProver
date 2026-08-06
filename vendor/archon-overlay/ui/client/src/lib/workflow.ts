export type WorkflowState =
  | 'AWAITING_REQUEST_CONFIRMATION' | 'RETHLAS_RUNNING' | 'PROPOSING_LEAN'
  | 'AWAITING_LEAN_CONFIRMATION' | 'ARCHON_RUNNING' | 'LEAN_VERIFIED'
  | 'NEEDS_ATTENTION' | 'FAILED' | 'CANCELLED';

export interface LeanProposal {
  declarationName: string;
  leanStatement: string;
  plainEnglish: string;
  assumptions: string[];
  leanFile: string;
  compileOk: boolean;
  compileOutput: string;
}

export interface WorkflowJob {
  id: string;
  slug: string;
  title: string;
  state: WorkflowState;
  maxIterations: number;
  requestHash: string;
  proposalHash?: string;
  proposal?: LeanProposal;
  requestMarkdown: string;
  referencePath?: string;
  blueprintMarkdown?: string;
  leanFile?: string;
  declarationName?: string;
  error?: string;
  blueprintExplanation?: string;
  explanationActive: boolean;
  explanationError?: string;
  explanationUpdatedAt?: string;
  logTail: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const WORKFLOW_LABELS: Record<WorkflowState, string> = {
  AWAITING_REQUEST_CONFIRMATION: 'Awaiting request confirmation',
  RETHLAS_RUNNING: 'Generating and verifying blueprint',
  PROPOSING_LEAN: 'Preparing Lean statement',
  AWAITING_LEAN_CONFIRMATION: 'Lean statement needs approval',
  ARCHON_RUNNING: 'Formalizing in Lean',
  LEAN_VERIFIED: 'Lean verified',
  NEEDS_ATTENTION: 'Needs attention',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};
