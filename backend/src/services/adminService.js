/**
 * Administrator controls (features #15 and #18): the review report queue and
 * account management.
 *
 * Every route that reaches this module goes through requireAdmin, which reads
 * the role fresh from MySQL. These functions still take the acting admin's ID
 * so they can refuse changes that would lock administrators out (suspending or
 * demoting yourself, or the last active admin).
 */
import * as reportRepository from '../repositories/reportRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import { ServiceError } from '../utils/errors.js';
import { toPublicUser } from '../utils/safeUser.js';
import { ACCOUNT_STATUSES, parseId, REPORT_REASONS, USER_ROLES } from '../utils/validation.js';

const REPORT_STATUSES = ['pending', 'dismissed', 'removed', 'reviewed'];

const withReasonLabel = (report) => ({ ...report, reasonLabel: REPORT_REASONS[report.reason] ?? report.reason });

// ---------- Reports ----------

/** `status`: one of REPORT_STATUSES or 'all'. Defaults to the pending queue. */
export async function listReports(rawStatus = 'pending') {
  const status = rawStatus === 'all' ? null : REPORT_STATUSES.includes(rawStatus) ? rawStatus : 'pending';
  const [reports, counts] = await Promise.all([reportRepository.listReports({ status }), reportRepository.countByStatus()]);
  return { reports: reports.map(withReasonLabel), counts };
}

async function requireReport(rawId) {
  const id = parseId(rawId);
  const report = id ? await reportRepository.findReportById(id) : null;
  if (!report) throw new ServiceError(404, 'Report not found.');
  return report;
}

async function reload(reportId) {
  return withReasonLabel(await reportRepository.findReportById(reportId));
}

/** Keep the review: closes this report. */
export async function dismissReport(adminId, rawId) {
  const report = await requireReport(rawId);
  if (report.status !== 'pending') throw new ServiceError(409, 'This report has already been handled.');
  await reportRepository.dismissReport(report.id, adminId);
  return reload(report.id);
}

/** Remove the review: hidden from everyone, its other open reports are closed. */
export async function removeReview(adminId, rawId) {
  const report = await requireReport(rawId);
  if (report.status !== 'pending') throw new ServiceError(409, 'This report has already been handled.');
  await reportRepository.removeReportedReview(report.id, report.review.id, adminId);
  return reload(report.id);
}

/** Undo a removal (e.g. removed by mistake). */
export async function restoreReview(adminId, rawId) {
  const report = await requireReport(rawId);
  if (!report.review.isRemoved) throw new ServiceError(409, 'This review isn’t removed.');
  await reportRepository.restoreReview(report.review.id, adminId);
  return reload(report.id);
}

// ---------- Accounts ----------

const toAdminUser = (user) => ({
  ...toPublicUser(user),
  email: user.email,
  role: user.role,
  accountStatus: user.accountStatus,
  reviewCount: user.reviewCount,
  flaggedCount: user.flaggedCount,
});

export async function listUsers(query = '') {
  const users = await userRepository.listUsersForAdmin({ query: String(query).slice(0, 100) });
  return users.map(toAdminUser);
}

async function requireOtherUser(adminId, rawId) {
  const id = parseId(rawId);
  const user = id ? await userRepository.findUserById(id) : null;
  if (!user) throw new ServiceError(404, 'User not found.');
  if (user.id === adminId) throw new ServiceError(400, 'You can’t change your own account here.');
  return user;
}

/** Last active admin can't be suspended or demoted, so the console never ends up unreachable. */
async function assertNotLastAdmin(user) {
  if (user.role === 'admin' && user.accountStatus === 'active' && (await userRepository.countActiveAdmins()) <= 1) {
    throw new ServiceError(400, 'TuneBoxd needs at least one active administrator.');
  }
}

/** body: { accountStatus?: 'active'|'suspended', role?: 'user'|'admin' } */
export async function updateUser(adminId, rawId, input = {}) {
  const user = await requireOtherUser(adminId, rawId);
  const { accountStatus, role } = input;
  if (accountStatus === undefined && role === undefined) throw new ServiceError(400, 'Nothing to change.');
  if (accountStatus !== undefined && !ACCOUNT_STATUSES.includes(accountStatus)) {
    throw new ServiceError(400, 'Account status must be active or suspended.');
  }
  if (role !== undefined && !USER_ROLES.includes(role)) throw new ServiceError(400, 'Role must be user or admin.');

  if (accountStatus === 'suspended' || role === 'user') await assertNotLastAdmin(user);
  if (accountStatus !== undefined) await userRepository.setAccountStatus(user.id, accountStatus);
  if (role !== undefined) await userRepository.setRole(user.id, role);

  // Suspended users are signed out on their next request: requireAuth re-reads
  // account_status from MySQL every time.
  return toAdminUser(await userRepository.findUserForAdmin(user.id));
}
