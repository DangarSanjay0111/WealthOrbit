const mongoose = require('mongoose');

const familyMembershipSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  familyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Family',
    required: true
  },
  role: {
    type: String,
    enum: ['head', 'member'],
    default: 'member'
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
});

// A user can only have one membership per family
familyMembershipSchema.index({ userId: 1, familyId: 1 }, { unique: true });

// Quick lookups by family
familyMembershipSchema.index({ familyId: 1 });

// Quick lookups by user
familyMembershipSchema.index({ userId: 1 });

module.exports = mongoose.model('FamilyMembership', familyMembershipSchema);
