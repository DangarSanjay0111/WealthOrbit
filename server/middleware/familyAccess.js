const FamilyMembership = require('../models/FamilyMembership');

/**
 * Middleware to check if user belongs to a family and optionally require 'head' role.
 * Extracts familyId from req.query.familyId, req.params.familyId, or req.body.familyId.
 * Attaches req.familyMembership with role info.
 */
const familyAccess = (requiredRole = null) => {
  return async (req, res, next) => {
    try {
      const familyId = req.query.familyId || req.params.familyId || req.body.familyId;

      if (!familyId) {
        return res.status(400).json({ message: 'Family ID is required.' });
      }

      const membership = await FamilyMembership.findOne({
        userId: req.userId,
        familyId: familyId
      });

      if (!membership) {
        return res.status(403).json({ message: 'You are not a member of this family.' });
      }

      if (requiredRole === 'head' && membership.role !== 'head') {
        return res.status(403).json({ message: 'Only family heads can perform this action.' });
      }

      req.familyMembership = membership;
      req.familyId = familyId;
      next();
    } catch (error) {
      return res.status(500).json({ message: 'Error checking family access.' });
    }
  };
};

module.exports = familyAccess;
