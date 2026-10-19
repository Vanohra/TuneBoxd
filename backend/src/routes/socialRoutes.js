import { Router } from 'express';
import * as socialController from '../controllers/socialController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

// Public: anyone can browse members and profiles (emails are never included).
router.get('/', socialController.listMembers);
router.get('/:username', socialController.getProfile);
router.get('/:username/followers', socialController.listFollowers);
router.get('/:username/following', socialController.listFollowing);
router.get('/:username/reviews', socialController.listReviews);
// Diary privacy is enforced in diaryService (private diaries: owner only).
router.get('/:username/diary', socialController.getDiary);

// Following someone requires a session.
router.post('/:username/follow', requireAuth, socialController.follow);
router.delete('/:username/follow', requireAuth, socialController.unfollow);

export default router;
