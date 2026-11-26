const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate, getJwtSecret } = require('../middleware/auth');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || '',
    policyNumber: user.policyNumber || '',
    department: user.department || '',
    createdAt: user.createdAt,
  };
}

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role, phone, policyNumber, department } = req.body;

    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ message: 'Name must be at least 2 characters.' });
    }
    if (!email || !EMAIL_REGEX.test(String(email).trim())) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const assignedRole = role === 'investigator' ? 'investigator' : 'customer';
    const passwordHash = await bcrypt.hash(String(password), 10);

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash,
      role: assignedRole,
      phone: phone ? String(phone).trim() : '',
      policyNumber: policyNumber ? String(policyNumber).trim().toUpperCase() : '',
      department: department ? String(department).trim() : assignedRole === 'investigator' ? 'SIU Fraud Unit' : '',
    });

    const token = signToken(user);
    return res.status(201).json({
      message: 'Account registered successfully.',
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const matches = await bcrypt.compare(String(password), user.passwordHash);
    if (!matches) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = signToken(user);
    return res.json({
      message: 'Login successful.',
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/profile
router.get('/profile', authenticate, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

// PUT /api/auth/profile
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const { name, phone, policyNumber, department } = req.body;
    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ message: 'Name must be at least 2 characters.' });
    }

    req.user.name = String(name).trim();
    if (phone !== undefined) req.user.phone = String(phone).trim();
    if (policyNumber !== undefined) req.user.policyNumber = String(policyNumber).trim().toUpperCase();
    if (department !== undefined) req.user.department = String(department).trim();

    await req.user.save();
    return res.json({
      message: 'Profile updated successfully.',
      user: sanitizeUser(req.user),
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/change-password
router.put('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }

    const userWithHash = await User.findById(req.user._id).select('+passwordHash');
    const isMatch = await bcrypt.compare(String(currentPassword), userWithHash.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    userWithHash.passwordHash = await bcrypt.hash(String(newPassword), 10);
    await userWithHash.save();

    return res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
