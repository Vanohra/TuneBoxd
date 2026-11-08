import { apiRequest } from './client.js';

// Administrator-only endpoints. The server checks the role on every request;
// hiding the Admin link in the UI is only a convenience.

/** status: 'pending' | 'dismissed' | 'removed' | 'reviewed' | 'all'. Returns { reports, counts }. */
export function fetchReports(status = 'pending') {
  return apiRequest(`/admin/reports?${new URLSearchParams({ status })}`);
}

/** action: 'dismiss' | 'remove' | 'restore'. Returns the updated report. */
export async function resolveReport(id, action) {
  const { report } = await apiRequest(`/admin/reports/${id}/${action}`, { method: 'POST' });
  return report;
}

export async function fetchAdminUsers(query = '') {
  const { users } = await apiRequest(`/admin/users?${new URLSearchParams({ q: query })}`);
  return users;
}

/** changes: { accountStatus?: 'active'|'suspended', role?: 'user'|'admin' } */
export async function updateAdminUser(id, changes) {
  const { user } = await apiRequest(`/admin/users/${id}`, { method: 'PATCH', body: changes });
  return user;
}
