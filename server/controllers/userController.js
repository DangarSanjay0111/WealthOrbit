const User = require('../models/User');

// GET /api/users/profile
exports.getProfile = async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile.', error: error.message });
  }
};

// PUT /api/users/profile
exports.updateProfile = async (req, res) => {
  try {
    const allowedFields = ['firstName', 'lastName', 'phone', 'panNumber', 'avatar'];
    const updates = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(req.userId, updates, {
      new: true,
      runValidators: true
    });

    res.json({ message: 'Profile updated.', user });
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile.', error: error.message });
  }
};

// PUT /api/users/password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }

    const user = await User.findById(req.userId).select('+password');
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error changing password.', error: error.message });
  }
};

// PUT /api/users/theme
exports.updateTheme = async (req, res) => {
  try {
    const { theme } = req.body;

    if (!['light', 'dark'].includes(theme)) {
      return res.status(400).json({ message: 'Theme must be "light" or "dark".' });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { 'settings.theme': theme },
      { new: true }
    );

    res.json({ message: 'Theme updated.', theme: user.settings.theme });
  } catch (error) {
    res.status(500).json({ message: 'Error updating theme.', error: error.message });
  }
};
