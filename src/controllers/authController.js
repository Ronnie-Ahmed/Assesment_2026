import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { publicUser } from '../utils/serializers.js';
const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });


export async function register(req, res) {
  try {
    const { name, email, password, interests } = req.body;

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
      interests,
      // role is deliberately NOT read from the body: public signup is always 'user'
    });

    res.status(201).json({ user: publicUser(user), token: signToken(user) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'email already registered' });
    }
    res.status(500).json({ message: 'server error' });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
    const ok = user && (await comparePassword(password, user.passwordHash));

    if (!ok) {
      return res.status(401).json({ message: 'invalid credentials' });
    }

    res.json({ user: publicUser(user), token: signToken(user) });
  } catch (err) {
    res.status(500).json({ message: 'server error' });
  }
}

export async function me(req, res) {
  const user = await User.findById(req.user.id);
  res.json({ user: publicUser(user) });
}