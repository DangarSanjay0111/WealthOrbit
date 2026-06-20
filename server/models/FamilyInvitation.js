const mongoose = require('mongoose');

const familyInvitationSchema = new mongoose.Schema({
  familyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Family',
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  }
}, {
  timestamps: true
});

familyInvitationSchema.index({ familyId: 1, receiverEmail: 1 }, { unique: true });
familyInvitationSchema.index({ receiverEmail: 1, status: 1 });

module.exports = mongoose.model('FamilyInvitation', familyInvitationSchema);
