export interface GraphTraceStep {
  node: 'rag' | 'agent' | 'tools' | 'parse';
  label: string;
  detail?: Record<string, unknown>;
}

export const MAX_TRACE_STEPS = 30;
export const MAX_TRACE_STRING = 500;
