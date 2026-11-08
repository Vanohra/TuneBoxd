import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

// Every route here is administrators only (role re-read from MySQL each request).
router.use(requireAdmin);

router.get('/reports', adminController.listReports);
router.post('/reports/:id/dismiss', adminController.dismissReport);
router.post('/reports/:id/remove', adminController.removeReview);
router.post('/reports/:id/restore', adminController.restoreReview);

router.get('/users', adminController.listUsers);
router.patch('/users/:id', adminController.updateUser);

export default router;
