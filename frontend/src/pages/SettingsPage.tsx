import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, KeyRound, LogOut, UserCircle } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { apiClient, extractErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [policyNumber, setPolicyNumber] = useState(user?.policyNumber || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    setSavingProfile(true);
    try {
      const res = await apiClient.put('/auth/profile', {
        name: name.trim(),
        phone: phone.trim(),
        policyNumber: policyNumber.trim(),
        department: department.trim(),
      });
      updateUser(res.data.user);
      setProfileMsg('Profile updated successfully.');
    } catch (err) {
      setProfileErr(extractErrorMessage(err, 'Failed to update profile.'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg('');
    setPwdErr('');

    if (newPassword.length < 6) {
      setPwdErr('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdErr('New passwords do not match.');
      return;
    }

    setSavingPwd(true);
    try {
      const res = await apiClient.put('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setPwdMsg(res.data.message || 'Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwdErr(extractErrorMessage(err, 'Failed to change password.'));
    } finally {
      setSavingPwd(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <AppLayout title="Profile & Settings" subtitle="Manage your account details, security, and session">
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Account Overview */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0B1E3D] text-sky-300">
              <UserCircle className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0B1E3D]">{user?.name}</h2>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>

          <dl className="mt-6 space-y-3 border-t border-slate-100 pt-4 text-xs">
            <div className="flex justify-between">
              <dt className="text-slate-500">Role</dt>
              <dd className="font-semibold uppercase text-[#0B1E3D]">
                {user?.role === 'investigator' ? 'Insurance Investigator' : 'Customer'}
              </dd>
            </div>
            {user?.policyNumber && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Policy Number</dt>
                <dd className="font-semibold text-slate-800">{user.policyNumber}</dd>
              </div>
            )}
            {user?.department && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Department</dt>
                <dd className="font-semibold text-slate-800">{user.department}</dd>
              </div>
            )}
          </dl>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>

        {/* Edit Profile + Password Forms */}
        <div className="space-y-6 lg:col-span-8">
          <form onSubmit={handleSaveProfile} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-[#0B1E3D]">Edit Profile</h2>
            {profileMsg && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {profileMsg}
              </div>
            )}
            {profileErr && (
              <div className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                {profileErr}
              </div>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                />
              </div>
              {user?.role === 'customer' ? (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase text-slate-600">
                    Policy Number
                  </label>
                  <input
                    type="text"
                    value={policyNumber}
                    onChange={(e) => setPolicyNumber(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm uppercase"
                  />
                </div>
              ) : (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase text-slate-600">
                    Department / Unit
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="mt-5 rounded-xl bg-[#0B1E3D] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#143666] disabled:opacity-50"
            >
              {savingProfile ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </form>

          <form
            onSubmit={handleChangePassword}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="flex items-center gap-2 text-base font-bold text-[#0B1E3D]">
              <KeyRound className="h-4 w-4 text-sky-600" />
              Change Password
            </h2>
            {pwdMsg && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {pwdMsg}
              </div>
            )}
            {pwdErr && (
              <div className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                {pwdErr}
              </div>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600">
                  Confirm New
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingPwd}
              className="mt-5 rounded-xl bg-[#0B1E3D] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#143666] disabled:opacity-50"
            >
              {savingPwd ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
