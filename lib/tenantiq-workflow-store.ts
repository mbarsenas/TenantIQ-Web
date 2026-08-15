import { authPool } from './tenantiq-users';

export type WorkflowState = 'needs_review' | 'in_progress' | 'ready_to_validate' | 'resolved';
export type WorkflowRecord = {
  state: WorkflowState;
  checkId: string;
  title: string;
  workloadName: string;
  updatedAt: string;
  resolvedAt?: string;
  assignedTo?: string;
  dueDate?: string;
  notes?: string;
};
export type WorkflowRecords = Record<string, WorkflowRecord>;

const allowedStates = new Set<WorkflowState>(['needs_review', 'in_progress', 'ready_to_validate', 'resolved']);

export async function ensureWorkflowSchema() {
  await authPool.query(`
    CREATE TABLE IF NOT EXISTS tenantiq_workflow_state (
      workspace_key TEXT NOT NULL,
      finding_key TEXT NOT NULL,
      state TEXT NOT NULL,
      check_id TEXT NOT NULL,
      title TEXT NOT NULL,
      workload_name TEXT NOT NULL,
      resolved_at TIMESTAMPTZ,
      assigned_to TEXT,
      due_date DATE,
      notes TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (workspace_key, finding_key)
    )
  `);
  await authPool.query(`ALTER TABLE tenantiq_workflow_state ADD COLUMN IF NOT EXISTS assigned_to TEXT`);
  await authPool.query(`ALTER TABLE tenantiq_workflow_state ADD COLUMN IF NOT EXISTS due_date DATE`);
  await authPool.query(`ALTER TABLE tenantiq_workflow_state ADD COLUMN IF NOT EXISTS notes TEXT`);
  await authPool.query(`CREATE INDEX IF NOT EXISTS tenantiq_workflow_workspace_idx ON tenantiq_workflow_state (workspace_key, updated_at DESC)`);
}

export async function getWorkflowRecords(workspaceKey: string): Promise<WorkflowRecords> {
  await ensureWorkflowSchema();
  const { rows } = await authPool.query(
    `SELECT finding_key, state, check_id, title, workload_name, resolved_at, assigned_to, due_date, notes, updated_at
     FROM tenantiq_workflow_state
     WHERE workspace_key = $1`,
    [workspaceKey],
  );
  const result: WorkflowRecords = {};
  for (const row of rows) {
    if (!allowedStates.has(row.state as WorkflowState)) continue;
    result[String(row.finding_key)] = {
      state: row.state as WorkflowState,
      checkId: String(row.check_id),
      title: String(row.title),
      workloadName: String(row.workload_name),
      updatedAt: new Date(row.updated_at).toISOString(),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : undefined,
      assignedTo: row.assigned_to ? String(row.assigned_to) : undefined,
      dueDate: row.due_date ? String(row.due_date).slice(0, 10) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
    };
  }
  return result;
}

export async function replaceWorkflowRecords(workspaceKey: string, records: WorkflowRecords) {
  await ensureWorkflowSchema();
  const client = await authPool.connect();
  try {
    await client.query('BEGIN');
    const keys = Object.keys(records);
    if (keys.length) {
      await client.query(`DELETE FROM tenantiq_workflow_state WHERE workspace_key = $1 AND NOT (finding_key = ANY($2::text[]))`, [workspaceKey, keys]);
    } else {
      await client.query(`DELETE FROM tenantiq_workflow_state WHERE workspace_key = $1`, [workspaceKey]);
    }

    for (const [findingKey, record] of Object.entries(records)) {
      if (!allowedStates.has(record.state)) continue;
      const assignedTo = String(record.assignedTo || '').trim().slice(0, 200) || null;
      const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(record.dueDate || '')) ? record.dueDate : null;
      const notes = String(record.notes || '').trim().slice(0, 5000) || null;
      await client.query(
        `INSERT INTO tenantiq_workflow_state
          (workspace_key, finding_key, state, check_id, title, workload_name, resolved_at, assigned_to, due_date, notes, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (workspace_key, finding_key) DO UPDATE SET
           state = EXCLUDED.state,
           check_id = EXCLUDED.check_id,
           title = EXCLUDED.title,
           workload_name = EXCLUDED.workload_name,
           resolved_at = EXCLUDED.resolved_at,
           assigned_to = EXCLUDED.assigned_to,
           due_date = EXCLUDED.due_date,
           notes = EXCLUDED.notes,
           updated_at = EXCLUDED.updated_at`,
        [workspaceKey, findingKey, record.state, record.checkId, record.title, record.workloadName, record.resolvedAt || null, assignedTo, dueDate, notes, record.updatedAt || new Date().toISOString()],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
