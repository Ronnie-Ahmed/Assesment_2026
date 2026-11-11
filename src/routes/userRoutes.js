import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateObjectId } from '../middleware/validateId.js';
import {
  createUser,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
  groupByInterests
} from '../controllers/userController.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.post('/', createUser);
router.get('/', listUsers);
router.get('/by-interests', groupByInterests);
router.get('/:id', validateObjectId(), getUser);
router.patch('/:id', validateObjectId(), updateUser);
router.delete('/:id', validateObjectId(), deleteUser);

export default router;