import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

// Every route here requires a valid session.
router.use(requireAuth);

router.get('/', userController.getCurrentUser);
router.patch('/', userController.updateCurrentUser);

export default router;
