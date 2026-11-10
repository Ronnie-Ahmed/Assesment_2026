import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, default: '', maxlength: 10000 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Serves "list my notes, newest first" (filter on owner, sort on _id),
// the admin's per-owner filter, and the cascade delete when a user is removed.
noteSchema.index({ owner: 1, _id: -1 });

export default mongoose.model('Note', noteSchema);