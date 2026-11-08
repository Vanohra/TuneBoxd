import * as listService from '../services/listService.js';

const viewerIdOf = (req) => req.session?.userId ?? null;

// GET /api/lists (requireAuth): your own lists, public and private
export async function listOwn(req, res) {
  res.json({ lists: await listService.listOwn(req.currentUser.id) });
}

// GET /api/lists/recent: newest public lists across TuneBoxd
export async function listRecent(req, res) {
  res.json({ lists: await listService.listRecentPublic(viewerIdOf(req)) });
}

// GET /api/lists/for/:targetType/:mbid (requireAuth): your lists, flagged if they contain this album/song
export async function listOwnForTarget(req, res) {
  res.json({ lists: await listService.listOwnForTarget(req.currentUser.id, req.params.targetType, req.params.mbid) });
}

// GET /api/lists/:id (private lists: owner only)
export async function getList(req, res) {
  res.json({ list: await listService.getList(req.params.id, viewerIdOf(req)) });
}

// POST /api/lists (requireAuth) body: { title, description?, isPublic? }
export async function createList(req, res) {
  const list = await listService.createList(req.currentUser.id, req.body ?? {});
  res.status(201).json({ list, message: 'List created.' });
}

// PATCH /api/lists/:id (requireAuth, owner only)
export async function updateList(req, res) {
  const list = await listService.updateList(req.currentUser.id, req.params.id, req.body ?? {});
  res.json({ list, message: 'List updated.' });
}

// DELETE /api/lists/:id (requireAuth, owner only)
export async function deleteList(req, res) {
  await listService.deleteList(req.currentUser.id, req.params.id);
  res.json({ message: 'List deleted.' });
}

// POST /api/lists/:id/items (requireAuth, owner only) body: { targetType, mbid }
export async function addItem(req, res) {
  const list = await listService.addItem(req.currentUser.id, req.params.id, req.body ?? {});
  res.status(201).json({ list, message: `Added to ${list.title}.` });
}

// DELETE /api/lists/:id/items/:key (requireAuth, owner only)
export async function removeItem(req, res) {
  const list = await listService.removeItem(req.currentUser.id, req.params.id, req.params.key);
  res.json({ list, message: 'Removed from the list.' });
}

// PUT /api/lists/:id/order (requireAuth, owner only) body: { keys: [...] }
export async function reorderItems(req, res) {
  const list = await listService.reorderItems(req.currentUser.id, req.params.id, req.body ?? {});
  res.json({ list, message: 'Order saved.' });
}
