import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
     interests: {
      type: [String],
      set: (arr) => [...new Set(arr.map((s) => String(s).trim().toLowerCase()).filter(Boolean))],
      default: [],
    },
  },
  { timestamps: true }
);

// Supports login and every lookup by email, and enforces uniqueness.
userSchema.index({ interests: 1 });

export default mongoose.model('User', userSchema);