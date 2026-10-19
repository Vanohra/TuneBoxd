import { Router } from 'express';
import * as diaryController from '../controllers/diaryController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

// Every route here manages the signed-in user's own diary.
// Other people's public diaries are at GET /api/users/:username/diary.
router.use(requireAuth);

router.get('/', diaryController.getOwnDiary);
router.post('/', diaryController.createEntry);
router.put('/settings', diaryController.updateSettings);
router.patch('/:id', diaryController.updateEntry);
router.delete('/:id', diaryController.deleteEntry);

export default router;
