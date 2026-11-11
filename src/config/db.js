import mongoose from 'mongoose';

let connecting = null;

export function connectDB() {
  if (mongoose.connection.readyState === 1 && !connecting) return Promise.resolve();
  if (!connecting) {
    connecting = mongoose
      .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 })
      .then(async () => {
        console.log('MongoDB connected');
        // Wait for every model's collection and indexes to be built,
        // so nothing is left half-built when a serverless function freezes.
        await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
      })
      .catch((err) => {
        connecting = null; // allow a retry on the next request
        throw err;
      });
  }
  return connecting;
}