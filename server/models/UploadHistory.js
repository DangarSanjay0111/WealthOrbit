const mongoose = require('mongoose');

const uploadHistorySchema = new mongoose.Schema({
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
  fileName: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  },
  extractedData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  holdingsCreated: {
    type: Number,
    default: 0
  },
  transactionsCreated: {
    type: Number,
    default: 0
  },
  errorMessage: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

uploadHistorySchema.index({ userId: 1, familyId: 1 });

module.exports = mongoose.model('UploadHistory', uploadHistorySchema);
