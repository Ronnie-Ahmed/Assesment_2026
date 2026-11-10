import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validateObjectId } from '../middleware/validateId.js';
import {
  createPost,
  listPosts,
  getPost,
  getPostsByUser,
} from '../controllers/postController.js';

const router = Router();

router.use(authenticate);

router.post('/', createPost);
router.get('/', listPosts);
router.get('/user/:userId', validateObjectId('userId'), getPostsByUser); // before '/:id'
router.get('/:id', validateObjectId(), getPost);

export default router;