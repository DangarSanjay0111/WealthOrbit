import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFamily } from '../../context/FamilyContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { User, Shield, Moon, Sun, Users, Plus, Crown, Trash2, UserPlus, Save } from 'lucide-react';
import './Profile.css';

export default function Profile() {
  const { user, updateUser, refreshFamilies, families } = useAuth();
  const { activeFamily, switchFamily } = useFamily();
  const { theme, toggleTheme } = useTheme();
  const { success, error: showError } = useToast();

  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', phone: '', panNumber: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [newFamilyName, setNewFamilyName] = useState('');
  const [familyDetails, setFamilyDetails] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileForm({ firstName: user.firstName || '', lastName: user.lastName || '', phone: user.phone || '', panNumber: user.panNumber || '' });
    }
  }, [user]);

  useEffect(() => {
    if (activeFamily) fetchFamilyDetails();
  }, [activeFamily]);

  const fetchFamilyDetails = async () => {
    try {
      const { data } = await api.get(`/families/${activeFamily._id}`);
      setFamilyDetails(data);
    } catch (err) {
      // Intentionally suppressed for prod
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      const { data } = await api.get('/families/invitations/pending');
      setInvitations(data.invitations || []);
    } catch { }
  };

  const handleRespond = async (id, action) => {
    try {
      await api.post(`/families/invitations/${id}/respond`, { action });
      fetchInvitations();
      refreshFamilies();
      if (action === 'accept') success('Invitation accepted!');
    } catch (err) {
      showError('Failed to respond to invitation');
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put('/users/profile', profileForm);
      updateUser(data.user);
      success('Profile updated!');
    } catch (err) { showError(err.response?.data?.message || 'Failed to update.'); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    try {
      await api.put('/users/password', passwordForm);
      success('Password changed!');
      setPasswordForm({ currentPassword: '', newPassword: '' });
    } catch (err) { showError(err.response?.data?.message || 'Failed to change password.'); }
  };

  const handleInviteMember = async () => {
    if (!addMemberEmail || inviting) return;
    setInviting(true);
    try {
      await api.post(`/families/${activeFamily._id}/invite`, { email: addMemberEmail });
      success('Invitation sent!');
      setAddMemberEmail('');
    } catch (err) { showError(err.response?.data?.message || 'Failed to send invitation.'); }
    finally { setInviting(false); }
  };

  const handlePromote = async (userId) => {
    try {
      await api.put(`/families/${activeFamily._id}/members/${userId}/role`, { role: 'head' });
      success('Member promoted to head!');
      fetchFamilyDetails();
    } catch (err) { showError(err.response?.data?.message || 'Failed to promote.'); }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Remove this member from the family?')) return;
    try {
      await api.delete(`/families/${activeFamily._id}/members/${userId}`);
      success('Member removed.');
      fetchFamilyDetails();
      refreshFamilies();
    } catch (err) { showError(err.response?.data?.message || 'Failed to remove member.'); }
  };

  const handleCreateFamily = async () => {
    if (!newFamilyName) return;
    try {
      await api.post('/families', { name: newFamilyName });
      success('Family created! You are the head.');
      setNewFamilyName('');
      refreshFamilies();
    } catch (err) { showError(err.response?.data?.message || 'Failed to create family.'); }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title"><User size={28} /> Profile & Settings</h1>
      </div>

      <div className="profile-grid">
        {/* Personal Info */}
        <div className="card">
          <h3 className="card-title mb-4"><User size={18} /> Personal Information</h3>
          <form onSubmit={handleUpdateProfile} className="profile-form">
            <div className="auth-row">
              <div className="input-group"><label className="input-label">First Name</label><input className="input" value={profileForm.firstName} onChange={e => setProfileForm({ ...profileForm, firstName: e.target.value })} required /></div>
              <div className="input-group"><label className="input-label">Last Name</label><input className="input" value={profileForm.lastName} onChange={e => setProfileForm({ ...profileForm, lastName: e.target.value })} required /></div>
            </div>
            <div className="input-group"><label className="input-label">Email</label><input className="input" value={user?.email || ''} disabled style={{ opacity: 0.6 }} /></div>
            <div className="auth-row">
              <div className="input-group"><label className="input-label">Phone</label><input className="input" value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} /></div>
              <div className="input-group"><label className="input-label">PAN Number</label><input className="input" value={profileForm.panNumber} onChange={e => setProfileForm({ ...profileForm, panNumber: e.target.value })} /></div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}><Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}</button>
          </form>
        </div>

        {/* Theme & Security */}
        <div className="flex-col gap-6" style={{ display: 'flex' }}>
          {/* Theme */}
          <div className="card">
            <h3 className="card-title mb-4">Appearance</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-sm text-secondary">Switch between dark and light mode</p>
              </div>
              <button className="btn btn-outline" onClick={toggleTheme}>
                {theme === 'dark' ? <><Sun size={16} /> Light Mode</> : <><Moon size={16} /> Dark Mode</>}
              </button>
            </div>
          </div>

          {/* Change Password */}
          <div className="card">
            <h3 className="card-title mb-4"><Shield size={18} /> Security</h3>
            <form onSubmit={handleChangePassword} className="profile-form">
              <div className="input-group"><label className="input-label">Current Password</label><input className="input" type="password" value={passwordForm.currentPassword} onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} required /></div>
              <div className="input-group"><label className="input-label">New Password</label><input className="input" type="password" value={passwordForm.newPassword} onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} required minLength={6} /></div>
              <button type="submit" className="btn btn-primary btn-sm">Change Password</button>
            </form>
          </div>
        </div>
      </div>

      {/* Pending Invitations */}
      <div className="card mt-6">
        <div className="card-header">
          <h3 className="card-title"><Users size={18} /> Pending Invitations</h3>
        </div>
        {invitations.length > 0 ? (
          <div className="flex flex-col gap-3">
            {invitations.map(inv => (
              <div key={inv._id} className="flex items-center justify-between p-3 rounded border border-primary bg-primary-light">
                <div>
                  <span className="font-medium">{inv.senderId?.firstName || 'Someone'} {inv.senderId?.lastName || ''}</span> invited you to join <span className="font-semibold">{inv.familyId?.name || 'a family'}</span>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-sm btn-primary" onClick={() => handleRespond(inv._id, 'accept')}>Accept</button>
                  <button className="btn btn-sm btn-outline" onClick={() => handleRespond(inv._id, 'reject')}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-secondary mb-0">You have no pending family invitations.</p>
        )}
      </div>

      {/* Family Management */}
      <div className="card mt-6">
        <div className="card-header flex items-center justify-between">
          <h3 className="card-title"><Users size={18} /> Family Management</h3>
          {families.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-secondary">Active Family:</span>
              <select 
                className="input input-sm" 
                style={{ width: 'auto', padding: '4px 8px' }}
                value={activeFamily?._id || ''} 
                onChange={(e) => {
                  const f = families.find(fam => fam._id === e.target.value);
                  if (f) switchFamily(f);
                }}
              >
                {families.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {activeFamily ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-lg">{activeFamily.name}</span>
              <span className="badge badge-primary">{familyDetails?.totalMembers || 0} members</span>
            </div>

            {/* Invite Member (Head Only) */}
            {familyDetails?.myRole === 'head' && (
              <div className="mb-6">
                <label className="input-label font-medium mb-1 block">Invite Member</label>
                <div className="flex items-center gap-2">
                  <input className="input" placeholder="Enter member email..." value={addMemberEmail} onChange={e => setAddMemberEmail(e.target.value)} style={{ maxWidth: 320 }} disabled={inviting} />
                  <button className="btn btn-accent btn-sm" onClick={handleInviteMember} disabled={inviting}>
                    <UserPlus size={14} /> {inviting ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
              </div>
            )}

            {/* Members List */}
            {familyDetails?.members && (
              <div className="table-container mb-6">
                <table className="table">
                  <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
                  <tbody>
                    {familyDetails.members.map(m => (
                      <tr key={m._id}>
                        <td className="font-medium">{m.firstName} {m.lastName}</td>
                        <td className="text-secondary">{m.email}</td>
                        <td><span className={`badge ${m.role === 'head' ? 'badge-primary' : 'badge-neutral'}`}>{m.role}</span></td>
                        <td>
                          {familyDetails?.myRole === 'head' && (
                            <div className="flex gap-2">
                              {m.role !== 'head' && (
                                <button className="btn btn-ghost btn-sm" onClick={() => handlePromote(m._id)} title="Promote to Head"><Crown size={14} /></button>
                              )}
                              {m._id !== user?._id && (
                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleRemoveMember(m._id)} title="Remove"><Trash2 size={14} /></button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="text-secondary mb-4">You are not a member of any family yet.</p>
        )}

        {/* Create Family */}
        <div className="dropdown-divider mb-4 mt-2" />
        <div className="mb-2">
          <label className="input-label font-medium mb-1 block">Create New Family</label>
          <div className="flex items-center gap-2">
            <input className="input" placeholder="Enter family name..." value={newFamilyName} onChange={e => setNewFamilyName(e.target.value)} style={{ maxWidth: 280 }} />
            <button className="btn btn-primary btn-sm" onClick={handleCreateFamily}><Plus size={14} /> Create</button>
          </div>
        </div>
      </div>
    </div>
  );
}
