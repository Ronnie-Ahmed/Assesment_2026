import User from '../models/User.js';
import { hashPassword } from '../utils/password.js';
import { publicUser } from '../utils/serializers.js';
import { parsePagination, buildPage } from '../utils/pagination.js';
import Note from '../models/Note.js';
import Post from '../models/Post.js';


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
    await Note.deleteMany({ owner: user._id });
    await Post.deleteMany({ author: user._id }); // served by the {author, _id} index
    res.status(204).send();
    res.status(204).send();
  } catch (err) {
    handleError(err, res);
  }
}

// Scenario 1: users grouped by interest, using exactly one aggregate() call.
export async function groupByInterests(req, res) {
  try {
    let limit = parseInt(req.query.limit, 10);
    if (!Number.isInteger(limit) || limit < 1) limit = 10;
    limit = Math.min(limit, 50);

    const interest = req.query.interest ? String(req.query.interest).trim().toLowerCase() : null;
    const cursor = req.query.cursor ? String(req.query.cursor) : null;

    const pipeline = [];
    if (interest) pipeline.push({ $match: { interests: interest } }); // uses the multikey index
    pipeline.push({ $unwind: '$interests' });
    if (interest) pipeline.push({ $match: { interests: interest } }); // keep only that group
    pipeline.push({
      $group: {
        _id: '$interests',
        count: { $sum: 1 },
        users: { $firstN: { input: { id: '$_id', name: '$name' }, n: 20 } },
      },
    });
    if (cursor) pipeline.push({ $match: { _id: { $gt: cursor } } });
    pipeline.push(
      { $sort: { _id: 1 } },
      { $limit: limit + 1 },
      { $project: { _id: 0, interest: '$_id', count: 1, users: 1 } }
    );

    const docs = await User.aggregate(pipeline);

    const hasMore = docs.length > limit;
    const data = hasMore ? docs.slice(0, limit) : docs;
    res.json({
      data,
      nextCursor: hasMore ? data[data.length - 1].interest : null,
      limit,
    });
  } catch (err) {
    handleError(err, res);
  }
}