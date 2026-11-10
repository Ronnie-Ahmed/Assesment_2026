import mongoose from 'mongoose';

export const validateObjectId = (param = 'id') => (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params[param])) {
    return res.status(400).json({ message: `invalid ${param}` });
  }
  next();
};