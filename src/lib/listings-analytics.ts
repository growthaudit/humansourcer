// Build-time only: compact per-role rows purpose-built for the /market-data/
// dashboard's client-side filtering/aggregation. Deliberately narrower than
// RoleRow (role-rows.ts) — no title/href/description, since the dashboard
// deals in counts and averages, not individual apply flows.
import type { RoleWithProvider } from './role-rows';
import { taskType, payAmount, TASK_TYPE_LABELS, type TaskType } from './role-taxonomy';

export interface ListingAnalyticsRow {
  id: string;
  providerSlug: string;
  workerBrand: string;
  category: string | null;
  taskType: TaskType;
  taskTypeLabel: string;
  hourlyRate: number | null;
  payText: string | null;
  createdAt: string;
}

export function toAnalyticsRow({ role, provider }: RoleWithProvider): ListingAnalyticsRow {
  const type = taskType(role);
  return {
    id: role.id,
    providerSlug: provider.slug,
    workerBrand: provider.workerBrand,
    category: role.category,
    taskType: type,
    taskTypeLabel: TASK_TYPE_LABELS[type],
    hourlyRate: payAmount(role),
    payText: role.pay_text,
    createdAt: role.first_seen_at,
  };
}
