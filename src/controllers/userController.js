import User from '../models/User.js';
import { hashPassword } from '../utils/password.js';
import { publicUser } from '../utils/serializers.js';
import { parsePagination, buildPage } from '../utils/pagination.js';

function handleError(err, res) {
  if (err.code === 11000) return res.status(409).json({ message: 'email already registered' });
  if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  return res.status(500).json({ message: 'server error' });
}

export async function createUser(req, res) {
  try {
    const { name, email, password, role, interests } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'password must be at least 8 characters' });
    }
    const user = await User.create({
      name,
      email,
      passwordHash: await hashPassword(password),
      role, // admins may set it; the schema enum validates it
      interests,
    });
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    handleError(err, res);
  }
}

export async function listUsers(req, res) {
  try {
    const parsed = parsePagination(req.query);
    if (!parsed) return res.status(400).json({ message: 'invalid cursor' });

    const docs = await User.find(parsed.filter)
      .sort({ _id: -1 }) // newest first, served by the default _id index
      .limit(parsed.limit + 1)
      .lean();

    const page = buildPage(docs, parsed.limit);
    res.json({ ...page, data: page.data.map(publicUser) });
  } catch (err) {
    handleError(err, res);
  }
}

export async function getUser(req, res) {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ message: 'user not found' });
    res.json({ user: publicUser(user) });
  } catch (err) {
    handleError(err, res);
  }
}

export async function updateUser(req, res) {
  try {
    const updates = {};
    for (const key of ['name', 'email', 'role', 'interests']) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.email) updates.email = String(updates.email).toLowerCase().trim();

    if (req.body.password !== undefined) {
      if (req.body.password.length < 8) {
        return res.status(400).json({ message: 'password must be at least 8 characters' });
      }
      updates.passwordHash = await hashPassword(req.body.password);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'nothing to update' });
    }
    if (req.params.id === req.user.id && updates.role && updates.role !== 'admin') {
      return res.status(400).json({ message: 'you cannot remove your own admin role' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!user) return res.status(404).json({ message: 'user not found' });
    res.json({ user: publicUser(user) });
  } catch (err) {
    handleError(err, res);
  }
}

export async function deleteUser(req, res) {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'you cannot delete yourself' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'user not found' });
    res.status(204).send();
  } catch (err) {
    handleError(err, res);
  }
}