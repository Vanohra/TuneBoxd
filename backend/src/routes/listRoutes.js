import { Router } from 'express';
import * as listController from '../controllers/listController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

// Public reads. Private lists are only returned to their owner (listService).
router.get('/recent', listController.listRecent);

// The signed-in user's own lists. Someone else's are at GET /api/users/:username/lists.
router.get('/', requireAuth, listController.listOwn);
router.get('/for/:targetType/:mbid', requireAuth, listController.listOwnForTarget);

router.get('/:id', listController.getList);

// Writes need a session; ownership is checked in listService.
router.post('/', requireAuth, listController.createList);
router.patch('/:id', requireAuth, listController.updateList);
router.delete('/:id', requireAuth, listController.deleteList);
router.post('/:id/items', requireAuth, listController.addItem);
router.delete('/:id/items/:key', requireAuth, listController.removeItem);
router.put('/:id/order', requireAuth, listController.reorderItems);

export default router;
