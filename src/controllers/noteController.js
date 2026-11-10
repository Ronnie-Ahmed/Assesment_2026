import mongoose from 'mongoose';
import Note from '../models/Note.js';
import { publicNote } from '../utils/serializers.js';
import { parsePagination, buildPage } from '../utils/pagination.js';

function handleError(err, res) {
  if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  return res.status(500).json({ message: 'server error' });
}

async function listNotes(res, query, extraFilter) {
  const parsed = parsePagination(query);
  if (!parsed) return res.status(400).json({ message: 'invalid cursor' });

  const docs = await Note.find({ ...extraFilter, ...parsed.filter })
    .sort({ _id: -1 })
    .limit(parsed.limit + 1)
    .lean();

  const page = buildPage(docs, parsed.limit);
  res.json({ ...page, data: page.data.map(publicNote) });
}

export async function createNote(req, res) {
  try {
    const { title, content } = req.body;
    const note = await Note.create({ title, content, owner: req.user.id });
    res.status(201).json({ note: publicNote(note) });
  } catch (err) {
    handleError(err, res);
  }
}

// Own notes only, for every role.
export async function listMyNotes(req, res) {
  try {
    await listNotes(res, req.query, { owner: req.user.id });
  } catch (err) {
    handleError(err, res);
  }
}

// Admin: everyone's notes, optionally filtered by owner.
export async function listAllNotes(req, res) {
  try {
    const extra = {};
    if (req.query.owner) {
      if (!mongoose.isValidObjectId(req.query.owner)) {
        return res.status(400).json({ message: 'invalid owner' });
      }
      extra.owner = req.query.owner;
    }
    await listNotes(res, req.query, extra);
  } catch (err) {
    handleError(err, res);
  }
}

// Owner can read their note; an admin can read any note.
export async function getNote(req, res) {
  try {
    const note = await Note.findById(req.params.id).lean();
    const allowed = note && (req.user.role === 'admin' || note.owner.toString() === req.user.id);
    if (!allowed) return res.status(404).json({ message: 'note not found' });
    res.json({ note: publicNote(note) });
  } catch (err) {
    handleError(err, res);
  }
}

// Owner only: the ownership check is part of the query itself.
export async function updateNote(req, res) {
  try {
    const updates = {};
    for (const key of ['title', 'content']) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'nothing to update' });
    }

    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.id },
      updates,
      { new: true, runValidators: true }
    );
    if (!note) return res.status(404).json({ message: 'note not found' });
    res.json({ note: publicNote(note) });
  } catch (err) {
    handleError(err, res);
  }
}

export async function deleteNote(req, res) {
  try {
    const note = await Note.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
    if (!note) return res.status(404).json({ message: 'note not found' });
    res.status(204).send();
  } catch (err) {
    handleError(err, res);
  }
}