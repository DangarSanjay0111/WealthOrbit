const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Family = require('../models/Family');
const FamilyMembership = require('../models/FamilyMembership');

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '15m'
  });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
  });
  return { accessToken, refreshToken };
};

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, familyName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    // Create user
    const user = await User.create({ email, password, firstName, lastName });

    // If familyName provided, create family and make user the head
    let family = null;
    if (familyName) {
      family = await Family.create({ name: familyName, createdBy: user._id });
      await FamilyMembership.create({
        userId: user._id,
        familyId: family._id,
        role: 'head'
      });
    }

    const tokens = generateTokens(user._id);

    res.status(201).json({
      message: 'Registration successful.',
      user: user.toJSON(),
      family,
      ...tokens
    });
    } catch (error) {
      // Intentionally suppressed for prod
      res.status(500).json({ message: 'Server error during registration.', error: error.message });
    }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Get user's families
    const memberships = await FamilyMembership.find({ userId: user._id })
      .populate('familyId');

    const tokens = generateTokens(user._id);

    res.json({
      message: 'Login successful.',
      user: user.toJSON(),
      families: memberships.map(m => ({
        _id: m.familyId._id,
        name: m.familyId.name,
        role: m.role,
        joinedAt: m.joinedAt
      })),
      ...tokens
    });
    } catch (error) {
      // Intentionally suppressed for prod
      res.status(500).json({ message: 'Server error during login.', error: error.message });
    }
};

// POST /api/auth/refresh
exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required.' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: 'Invalid refresh token.' });
    }

    const tokens = generateTokens(user._id);
    res.json(tokens);
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired refresh token.' });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const memberships = await FamilyMembership.find({ userId: req.userId })
      .populate('familyId');

    res.json({
      user: req.user,
      families: memberships.map(m => ({
        _id: m.familyId._id,
        name: m.familyId.name,
        role: m.role,
        joinedAt: m.joinedAt
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user info.', error: error.message });
  }
};
