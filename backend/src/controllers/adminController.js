import * as adminService from '../services/adminService.js';

// GET /api/admin/reports?status=pending|dismissed|removed|reviewed|all&sort=date|severity
export async function listReports(req, res) {
  res.json(await adminService.listReports(req.query.status, req.query.sort));
}

// POST /api/admin/reports/:id/analyze: run the AI moderation assistant on the reported review
export async function analyzeReport(req, res) {
  const report = await adminService.analyzeReport(req.params.id);
  res.json({ report, message: 'AI analysis updated.' });
}

// POST /api/admin/reports/:id/dismiss: keep the review
export async function dismissReport(req, res) {
  const report = await adminService.dismissReport(req.currentUser.id, req.params.id);
  res.json({ report, message: 'Report dismissed. The review stays up.' });
}

// POST /api/admin/reports/:id/remove: hide the review from everyone
export async function removeReview(req, res) {
  const report = await adminService.removeReview(req.currentUser.id, req.params.id);
  res.json({ report, message: 'Review removed.' });
}

// POST /api/admin/reports/:id/restore: undo a removal
export async function restoreReview(req, res) {
  const report = await adminService.restoreReview(req.currentUser.id, req.params.id);
  res.json({ report, message: 'Review restored.' });
}

// GET /api/admin/users?q=
export async function listUsers(req, res) {
  res.json({ users: await adminService.listUsers(req.query.q ?? '') });
}

// PATCH /api/admin/users/:id body: { accountStatus?, role? }
export async function updateUser(req, res) {
  const user = await adminService.updateUser(req.currentUser.id, req.params.id, req.body ?? {});
  res.json({ user, message: `@${user.username} updated.` });
}
