import type { Tx } from '../db.js';
import { pool } from '../db.js';

export async function audit(actor: string, action: string, target: string | null, detail: unknown = {}, c?: Tx) {
  await (c ?? pool).query(`INSERT INTO audit_logs (actor, action, target, detail) VALUES ($1,$2,$3,$4)`, [actor, action, target, JSON.stringify(detail)]);
}
