const express = require('express');
const router = express.Router();
const {
  createFamily, getMyFamilies, getFamilyDetails,
  inviteMember, removeMember, updateMemberRole,
  getInvitations, respondToInvitation
} = require('../controllers/familyController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', getMyFamilies);
router.post('/', createFamily);

// Invitations
router.get('/invitations/pending', getInvitations);
router.post('/invitations/:id/respond', respondToInvitation);

// Family details & members
router.get('/:familyId', getFamilyDetails);
router.post('/:familyId/invite', inviteMember);
router.delete('/:familyId/members/:userId', removeMember);
router.put('/:familyId/members/:userId/role', updateMemberRole);

module.exports = router;
