import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, default: '', maxlength: 10000 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Serves the $lookup (match on author, sorted newest first) and the
// cascade delete when a user is removed.
postSchema.index({ author: 1, _id: -1 });

export default mongoose.model('Post', postSchema);