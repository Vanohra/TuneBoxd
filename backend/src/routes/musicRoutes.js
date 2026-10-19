import { Router } from 'express';
import * as musicController from '../controllers/musicController.js';

const router = Router();

// Public: browsing music and reading reviews works without an account.
router.get('/search', musicController.search);
router.get('/albums/:mbid', musicController.getAlbum);
router.get('/albums/:mbid/reviews', musicController.getAlbumReviews);
router.get('/artists/:mbid', musicController.getArtist);
router.get('/songs/:mbid', musicController.getSong);
router.get('/songs/:mbid/reviews', musicController.getSongReviews);

export default router;
