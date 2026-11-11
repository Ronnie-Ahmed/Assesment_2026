import mongoose from 'mongoose';
import Post from '../models/Post.js';
import User from '../models/User.js';
import { publicPost } from '../utils/serializers.js';
import { parsePagination, buildPage } from '../utils/pagination.js';

const { ObjectId } = mongoose.Types;

function handleError(err, res) {
  if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  return res.status(500).json({ message: 'server error' });
}

export async function createPost(req, res) {
  try {
    const { title, content } = req.body;
    const post = await Post.create({ title, content, author: req.user.id });
    res.status(201).json({ post: publicPost(post) });
  } catch (err) {
    handleError(err, res);
  }
}

// All posts, newest first. Served by the default _id index.
export async function listPosts(req, res) {
  try {
    const parsed = parsePagination(req.query);
    if (!parsed) return res.status(400).json({ message: 'invalid cursor' });

    const docs = await Post.find(parsed.filter)
      .sort({ _id: -1 })
      .limit(parsed.limit + 1)
      .populate('author', 'name')
      .lean();

    const page = buildPage(docs, parsed.limit);
    res.json({ ...page, data: page.data.map(publicPost) });
  } catch (err) {
    handleError(err, res);
  }
}

export async function getPost(req, res) {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'name').lean();
    if (!post) return res.status(404).json({ message: 'post not found' });
    res.json({ post: publicPost(post) });
  } catch (err) {
    handleError(err, res);
  }
}

// Scenario 2: all posts of one user, in a single aggregation with $lookup.
export async function getPostsByUser(req, res) {
  try {
    const parsed = parsePagination(req.query);
    if (!parsed) return res.status(400).json({ message: 'invalid cursor' });

    // Aggregation does not auto-cast strings, so build ObjectIds explicitly.
    const cursorMatch = parsed.filter._id
      ? { _id: { $lt: new ObjectId(parsed.filter._id.$lt) } }
      : {};

    const [result] = await User.aggregate([
      { $match: { _id: new ObjectId(req.params.userId) } },
      {
        $lookup: {
          from: Post.collection.name,
          let: { uid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$author', '$$uid'] }, ...cursorMatch } },
            { $sort: { _id: -1 } },
            { $limit: parsed.limit + 1 },
            { $project: { title: 1, content: 1, createdAt: 1 } },
          ],
          as: 'posts',
        },
      },
      { $project: { name: 1, posts: 1 } },
    ]);

    if (!result) return res.status(404).json({ message: 'user not found' });

    const page = buildPage(result.posts, parsed.limit);
    res.json({
      author: { id: result._id, name: result.name },
      data: page.data.map((p) => ({
        id: p._id,
        title: p.title,
        content: p.content,
        createdAt: p.createdAt,
      })),
      nextCursor: page.nextCursor,
      limit: page.limit,
    });
  } catch (err) {
    handleError(err, res);
  }
}