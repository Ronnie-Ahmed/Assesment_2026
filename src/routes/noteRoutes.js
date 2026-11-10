import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateObjectId } from '../middleware/validateId.js';
import {
  createNote,
  listMyNotes,
  listAllNotes,
  getNote,
  updateNote,
  deleteNote,
} from '../controllers/noteController.js';

const router = Router();

router.use(authenticate);

router.post('/', createNote);
router.get('/', listMyNotes);
router.get('/all', authorize('admin'), listAllNotes); // must come before '/:id'
router.get('/:id', validateObjectId(), getNote);
router.patch('/:id', validateObjectId(), updateNote);
router.delete('/:id', validateObjectId(), deleteNote);

export default router;