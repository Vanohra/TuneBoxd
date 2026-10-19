import * as diaryService from '../services/diaryService.js';

// GET /api/diary (requireAuth): your own diary, public or private
export async function getOwnDiary(req, res) {
  res.json(await diaryService.getOwnDiary(req.currentUser.id));
}

// POST /api/diary (requireAuth)
export async function createEntry(req, res) {
  const entry = await diaryService.createEntry(req.currentUser.id, req.body ?? {});
  res.status(201).json({ entry, message: 'Added to your diary.' });
}

// PATCH /api/diary/:id (requireAuth, owner only)
export async function updateEntry(req, res) {
  const entry = await diaryService.updateEntry(req.currentUser.id, req.params.id, req.body ?? {});
  res.json({ entry, message: 'Diary entry updated.' });
}

// DELETE /api/diary/:id (requireAuth, owner only)
export async function deleteEntry(req, res) {
  await diaryService.deleteEntry(req.currentUser.id, req.params.id);
  res.json({ message: 'Diary entry deleted.' });
}

// PUT /api/diary/settings (requireAuth) body: { visibility: 'public' | 'private' }
export async function updateSettings(req, res) {
  const visibility = await diaryService.setVisibility(req.currentUser.id, req.body ?? {});
  res.json({ visibility, message: visibility === 'private' ? 'Your diary is now private.' : 'Your diary is now public.' });
}
