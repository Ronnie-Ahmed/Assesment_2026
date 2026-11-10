import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function authenticate(req, res, next) {
  try {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'missing or malformed token' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // One lookup by _id (default index, no new index needed).
    const user = await User.findById(payload.sub).select('role').lean();
    if (!user) {
      return res.status(401).json({ message: 'user no longer exists' });
    }

    req.user = { id: user._id.toString(), role: user.role };
    next();
  } catch (err) {
    res.status(401).json({ message: 'invalid or expired token' });
  }
}

export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'forbidden' });
  }
  next();
};