const Family = require('../models/Family');
const FamilyMembership = require('../models/FamilyMembership');
const FamilyInvitation = require('../models/FamilyInvitation');
const User = require('../models/User');

// POST /api/families — Create a new family (creator becomes head)
exports.createFamily = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Family name is required.' });
    }

    const family = await Family.create({ name, createdBy: req.userId });

    await FamilyMembership.create({
      userId: req.userId,
      familyId: family._id,
      role: 'head'
    });

    res.status(201).json({
      message: 'Family created. You are the head.',
      family,
      role: 'head'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating family.', error: error.message });
  }
};

// GET /api/families — List all families user belongs to
exports.getMyFamilies = async (req, res) => {
  try {
    const memberships = await FamilyMembership.find({ userId: req.userId })
      .populate('familyId');

    const families = memberships.map(m => ({
      _id: m.familyId._id,
      name: m.familyId.name,
      role: m.role,
      joinedAt: m.joinedAt,
      createdBy: m.familyId.createdBy
    }));

    res.json({ families });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching families.', error: error.message });
  }
};

// GET /api/families/:familyId — Get family details + members
exports.getFamilyDetails = async (req, res) => {
  try {
    const { familyId } = req.params;

    const family = await Family.findById(familyId).populate('createdBy', 'firstName lastName email');
    if (!family) {
      return res.status(404).json({ message: 'Family not found.' });
    }

    // Check user is a member
    const myMembership = await FamilyMembership.findOne({
      userId: req.userId,
      familyId
    });

    if (!myMembership) {
      return res.status(403).json({ message: 'You are not a member of this family.' });
    }

    // Get all members
    const memberships = await FamilyMembership.find({ familyId })
      .populate('userId', 'firstName lastName email avatar phone');

    const members = memberships.map(m => ({
      _id: m.userId._id,
      firstName: m.userId.firstName,
      lastName: m.userId.lastName,
      email: m.userId.email,
      avatar: m.userId.avatar,
      phone: m.userId.phone,
      role: m.role,
      joinedAt: m.joinedAt
    }));

    res.json({
      family,
      members,
      myRole: myMembership.role,
      totalMembers: members.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching family details.', error: error.message });
  }
};

// POST /api/families/:familyId/invite — Head: invite a member by email
exports.inviteMember = async (req, res) => {
  try {
    const { familyId } = req.params;
    const { email } = req.body;

    const requesterMembership = await FamilyMembership.findOne({
      userId: req.userId,
      familyId,
      role: 'head'
    });

    if (!requesterMembership) {
      return res.status(403).json({ message: 'Only heads can invite members.' });
    }

    const emailLower = email.toLowerCase().trim();

    // Check if they are already a member
    const user = await User.findOne({ email: emailLower });
    if (user) {
      const existing = await FamilyMembership.findOne({ userId: user._id, familyId });
      if (existing) {
        return res.status(400).json({ message: 'This user is already a member.' });
      }
    }

    // Check if invitation already sent
    const existingInvite = await FamilyInvitation.findOne({ familyId, receiverEmail: emailLower, status: 'pending' });
    if (existingInvite) {
      return res.status(400).json({ message: 'An invitation is already pending for this email.' });
    }

    const invite = await FamilyInvitation.create({
      familyId,
      senderId: req.userId,
      receiverEmail: emailLower
    });

    res.status(201).json({ message: `Invitation sent to ${emailLower}`, invite });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Invitation already exists.' });
    }
    res.status(500).json({ message: 'Error sending invitation.', error: error.message });
  }
};

// GET /api/families/invitations/pending — User: get pending invitations
exports.getInvitations = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const invitations = await FamilyInvitation.find({
      receiverEmail: user.email.toLowerCase(),
      status: 'pending'
    }).populate('familyId', 'name').populate('senderId', 'firstName lastName email');

    res.json({ invitations });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching invitations.', error: error.message });
  }
};

// POST /api/families/invitations/:id/respond — User: accept or reject
exports.respondToInvitation = async (req, res) => {
  try {
    const { action } = req.body; // 'accept' or 'reject'
    const user = await User.findById(req.userId);

    const invite = await FamilyInvitation.findOne({
      _id: req.params.id,
      receiverEmail: user.email.toLowerCase(),
      status: 'pending'
    });

    if (!invite) {
      return res.status(404).json({ message: 'Invitation not found or already processed.' });
    }

    if (action === 'accept') {
      invite.status = 'accepted';
      await invite.save();

      // Check if membership already exists (sanity check)
      const existing = await FamilyMembership.findOne({ userId: req.userId, familyId: invite.familyId });
      if (!existing) {
        await FamilyMembership.create({
          userId: req.userId,
          familyId: invite.familyId,
          role: 'member'
        });
      }
      return res.json({ message: 'Invitation accepted. You are now a family member.' });
    } else if (action === 'reject') {
      invite.status = 'rejected';
      await invite.save();
      return res.json({ message: 'Invitation rejected.' });
    } else {
      return res.status(400).json({ message: 'Invalid action.' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error responding to invitation.', error: error.message });
  }
};

// DELETE /api/families/:familyId/members/:userId — Head: remove a member
exports.removeMember = async (req, res) => {
  try {
    const { familyId, userId } = req.params;

    // Check requester is head
    const requesterMembership = await FamilyMembership.findOne({
      userId: req.userId,
      familyId,
      role: 'head'
    });

    if (!requesterMembership) {
      return res.status(403).json({ message: 'Only heads can remove members.' });
    }

    // Cannot remove yourself if you're the only head
    if (userId === req.userId.toString()) {
      const headCount = await FamilyMembership.countDocuments({
        familyId,
        role: 'head'
      });

      if (headCount <= 1) {
        return res.status(400).json({
          message: 'Cannot remove yourself. You are the only head. Promote another member first.'
        });
      }
    }

    const result = await FamilyMembership.findOneAndDelete({
      userId,
      familyId
    });

    if (!result) {
      return res.status(404).json({ message: 'Membership not found.' });
    }

    res.json({ message: 'Member removed from family.' });
  } catch (error) {
    res.status(500).json({ message: 'Error removing member.', error: error.message });
  }
};

// PUT /api/families/:familyId/members/:userId/role — Head: promote member to head
exports.updateMemberRole = async (req, res) => {
  try {
    const { familyId, userId } = req.params;
    const { role } = req.body;

    if (!['head', 'member'].includes(role)) {
      return res.status(400).json({ message: 'Role must be "head" or "member".' });
    }

    // Check requester is head
    const requesterMembership = await FamilyMembership.findOne({
      userId: req.userId,
      familyId,
      role: 'head'
    });

    if (!requesterMembership) {
      return res.status(403).json({ message: 'Only heads can change roles.' });
    }

    // If demoting a head, ensure at least one head remains
    if (role === 'member') {
      const targetMembership = await FamilyMembership.findOne({ userId, familyId });
      if (targetMembership && targetMembership.role === 'head') {
        const headCount = await FamilyMembership.countDocuments({
          familyId,
          role: 'head'
        });
        if (headCount <= 1) {
          return res.status(400).json({
            message: 'Cannot demote. At least one head is required.'
          });
        }
      }
    }

    const membership = await FamilyMembership.findOneAndUpdate(
      { userId, familyId },
      { role },
      { new: true }
    ).populate('userId', 'firstName lastName email');

    if (!membership) {
      return res.status(404).json({ message: 'Membership not found.' });
    }

    res.json({
      message: `${membership.userId.firstName} is now a ${role}.`,
      member: {
        _id: membership.userId._id,
        firstName: membership.userId.firstName,
        lastName: membership.userId.lastName,
        role: membership.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating role.', error: error.message });
  }
};
