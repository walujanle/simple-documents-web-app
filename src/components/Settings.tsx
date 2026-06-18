import { useEffect, useId, useRef, useState } from 'react';
import { useDocs } from '@/components/DocContext';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Database,
  Download,
  Globe,
  Lock,
  Settings as SettingsIcon,
  Upload,
  User,
} from '@/components/Icons';

type FormSubmitEvent = {
  preventDefault: () => void;
};

export default function Settings() {
  const fieldIdPrefix = useId().replace(/:/g, '');
  const usernameId = `${fieldIdPrefix}-username`;
  const fullNameId = `${fieldIdPrefix}-full-name`;
  const websiteId = `${fieldIdPrefix}-website`;
  const profileDescriptionId = `${fieldIdPrefix}-profile-description`;
  const isFeaturedToggleId = `${fieldIdPrefix}-is-featured-toggle`;
  const twitterId = `${fieldIdPrefix}-twitter`;
  const facebookId = `${fieldIdPrefix}-facebook`;
  const instagramId = `${fieldIdPrefix}-instagram`;
  const linkedinId = `${fieldIdPrefix}-linkedin`;
  const mastodonId = `${fieldIdPrefix}-mastodon`;
  const blueskyId = `${fieldIdPrefix}-bluesky`;
  const currentPasswordId = `${fieldIdPrefix}-current-password`;
  const newPasswordId = `${fieldIdPrefix}-new-password`;
  const confirmPasswordId = `${fieldIdPrefix}-confirm-password`;
  const autoSaveToggleId = `${fieldIdPrefix}-auto-save-toggle`;
  const markdownImportFileId = `${fieldIdPrefix}-markdown-import-file`;
  const backupRestoreFileId = `${fieldIdPrefix}-backup-restore-file`;
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [facebook, setFacebook] = useState('');
  const [instagram, setInstagram] = useState('');
  const [twitter, setTwitter] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [mastodon, setMastodon] = useState('');
  const [bluesky, setBluesky] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const [autoSave, setAutoSave] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'profile' | 'socials' | 'security' | 'preferences' | 'portability'
  >('profile');
  const { importMarkdown, restoreBackup } = useDocs();
  const importInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedAutoSave = localStorage.getItem('monodoc_autosave') !== 'false';
    setAutoSave(savedAutoSave);
  }, []);

  const handleAutoSaveToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setAutoSave(checked);
    localStorage.setItem('monodoc_autosave', checked ? 'true' : 'false');
  };

  const handleImportClick = () => importInputRef.current?.click();
  const handleRestoreClick = () => restoreInputRef.current?.click();

  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await importMarkdown(file);
      e.target.value = '';
    }
  };

  const handleRestoreChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (
        confirm(
          'Are you sure you want to restore this backup? This will overwrite or update your existing documents.',
        )
      ) {
        await restoreBackup(file);
      }
      e.target.value = '';
    }
  };

  const handleExportBackup = () => {
    window.open('/api/documents/backup', '_blank');
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setName(data.name || '');
          setUsername(data.username || '');
          setWebsite(data.website || '');
          setFacebook(data.facebook || '');
          setInstagram(data.instagram || '');
          setTwitter(data.twitter || '');
          setLinkedin(data.linkedin || '');
          setMastodon(data.mastodon || '');
          setBluesky(data.bluesky || '');
          setIsFeatured(!!data.isFeatured);
          setDescription(data.description || '');
        }
      } catch (e) {
        console.error('Failed to fetch user profile:', e);
      }
    };
    fetchProfile();
  }, []);

  const handleSubmit = async (e: FormSubmitEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (activeTab === 'security') {
        if (!currentPassword) {
          setError('Current password is required to change password');
          setLoading(false);
          return;
        }
        if (newPassword !== confirmPassword) {
          setError('New passwords do not match');
          setLoading(false);
          return;
        }
        if (newPassword.length < 6) {
          setError('New password must be at least 6 characters long');
          setLoading(false);
          return;
        }

        const response = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to update password');
        }

        setSuccess('Password updated successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const payload = {
          name: name.trim(),
          website: website.trim(),
          facebook: facebook.trim(),
          instagram: instagram.trim(),
          twitter: twitter.trim(),
          linkedin: linkedin.trim(),
          mastodon: mastodon.trim(),
          bluesky: bluesky.trim(),
          isFeatured: isFeatured,
          description: description.trim(),
        };

        const response = await fetch('/api/auth/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to update profile');
        }

        setSuccess('Profile updated successfully');
      }

      // Reload profile to ensure it is in sync
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const profileData = await res.json();
        setName(profileData.name || '');
        setUsername(profileData.username || '');
        setWebsite(profileData.website || '');
        setFacebook(profileData.facebook || '');
        setInstagram(profileData.instagram || '');
        setTwitter(profileData.twitter || '');
        setLinkedin(profileData.linkedin || '');
        setMastodon(profileData.mastodon || '');
        setBluesky(profileData.bluesky || '');
        setIsFeatured(!!profileData.isFeatured);
        setDescription(profileData.description || '');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile Details', icon: <User className="w-4 h-4" /> },
    { id: 'socials', label: 'Social Media', icon: <Globe className="w-4 h-4" /> },
    { id: 'security', label: 'Security & Auth', icon: <Lock className="w-4 h-4" /> },
    { id: 'preferences', label: 'Preferences', icon: <SettingsIcon className="w-4 h-4" /> },
    { id: 'portability', label: 'Data Portability', icon: <Database className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="w-full max-w-4xl mx-auto mt-12 p-8 rounded-xl border border-border-custom bg-bg-card text-text-main shadow-lg">
      <div className="flex items-center gap-2 mb-6 select-none">
        <a
          href="/documents"
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text-main transition-colors font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Workspace
        </a>
      </div>

      <div className="flex flex-col mb-8 border-b border-border-custom/50 pb-5 select-none">
        <h1 className="text-2xl font-black tracking-tight">Account Settings</h1>
        <p className="text-xs text-text-muted mt-1">
          Manage your author profile, connected social handles, passwords, and data portability.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-8">
        {/* Navigation Sidebar */}
        <div className="flex flex-row overflow-x-auto sm:flex-col gap-1.5 sm:col-span-1 select-none border-b sm:border-b-0 sm:border-r border-border-custom/50 pb-4 sm:pb-0 sm:pr-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setError('');
                setSuccess('');
              }}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer outline-none focus:outline-none ${
                activeTab === tab.id
                  ? 'bg-text-main text-bg-card font-black shadow-md'
                  : 'hover:bg-border-custom/30 text-text-muted hover:text-text-main'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="sm:col-span-3">
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-5 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-500 text-xs flex items-center gap-2 font-medium">
              <Check className="w-4.5 h-4.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Active Tab Panels */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="mb-4">
                <h3 className="text-sm font-black text-text-main mb-1 select-none">
                  Profile Details
                </h3>
                <p className="text-3xs text-text-muted select-none">
                  Update your default author information.
                </p>
              </div>

              <div>
                <label
                  htmlFor={usernameId}
                  className="block text-2xs font-bold uppercase tracking-widest mb-1 text-text-muted select-none"
                >
                  Username
                </label>
                <input
                  id={usernameId}
                  type="text"
                  readOnly
                  value={username}
                  className="w-full px-4 py-2.5 rounded-lg border border-border-custom bg-bg-app text-text-muted outline-none cursor-not-allowed select-none font-mono"
                />
              </div>

              <div>
                <label
                  htmlFor={fullNameId}
                  className="block text-2xs font-bold uppercase tracking-widest mb-1 text-text-muted select-none"
                >
                  Full Name
                </label>
                <input
                  id={fullNameId}
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border-custom bg-bg-app text-text-main outline-none focus:ring-1 focus:ring-text-main focus:border-text-main transition-all placeholder:text-text-muted/40 font-semibold"
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label
                  htmlFor={websiteId}
                  className="block text-2xs font-bold uppercase tracking-widest mb-1 text-text-muted select-none"
                >
                  Personal Website
                </label>
                <input
                  id={websiteId}
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border-custom bg-bg-app text-text-main outline-none focus:ring-1 focus:ring-text-main focus:border-text-main transition-all placeholder:text-text-muted/40 font-semibold"
                  placeholder="https://yourwebsite.com"
                />
              </div>

              <div>
                <label
                  htmlFor={profileDescriptionId}
                  className="block text-2xs font-bold uppercase tracking-widest mb-1 text-text-muted select-none"
                >
                  Profile Description / Bio
                </label>
                <textarea
                  id={profileDescriptionId}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border-custom bg-bg-app text-text-main outline-none focus:ring-1 focus:ring-text-main focus:border-text-main transition-all placeholder:text-text-muted/40 font-semibold resize-none h-20 text-xs"
                  placeholder="Tell us about yourself..."
                />
              </div>

              {username && (
                <div className="p-3.5 rounded-lg border border-border-custom bg-bg-app flex items-center justify-between text-3xs text-text-muted select-none mt-2">
                  <span className="font-medium">Your public profile directory:</span>
                  <a
                    href={`/${username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-bold text-text-main hover:underline"
                  >
                    <Globe className="w-3.5 h-3.5" />/{username}
                  </a>
                </div>
              )}

              <div className="flex items-center justify-between p-4 rounded-lg border border-border-custom bg-bg-app mt-6 select-none">
                <div>
                  <label
                    htmlFor={isFeaturedToggleId}
                    className="text-xs font-bold text-text-main block"
                  >
                    Feature Account on Homepage
                  </label>
                  <p className="text-3xs text-text-muted">
                    Opt-in to listing your profile in the landing page directory and search results.
                  </p>
                </div>
                <input
                  id={isFeaturedToggleId}
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-4.5 h-4.5 text-text-main border-border-custom rounded focus:ring-text-main accent-text-main cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-6 px-6 py-2.5 rounded-lg bg-text-main text-bg-card font-bold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 cursor-pointer select-none"
              >
                <Lock className="w-4.5 h-4.5" />
                {loading ? 'Saving Changes...' : 'Save Profile'}
              </button>
            </form>
          )}

          {activeTab === 'socials' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="mb-4">
                <h3 className="text-sm font-black text-text-main mb-1 select-none">
                  Website & Social Media
                </h3>
                <p className="text-3xs text-text-muted select-none">
                  Configure social handles linked to your articles.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor={twitterId}
                    className="block text-2xs font-bold uppercase tracking-widest mb-1 text-text-muted select-none"
                  >
                    X / Twitter
                  </label>
                  <input
                    id={twitterId}
                    type="text"
                    value={twitter}
                    onChange={(e) => setTwitter(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border-custom bg-bg-app text-text-main outline-none focus:ring-1 focus:ring-text-main focus:border-text-main transition-all placeholder:text-text-muted/40 font-semibold"
                    placeholder="username"
                  />
                </div>

                <div>
                  <label
                    htmlFor={facebookId}
                    className="block text-2xs font-bold uppercase tracking-widest mb-1 text-text-muted select-none"
                  >
                    Facebook
                  </label>
                  <input
                    id={facebookId}
                    type="text"
                    value={facebook}
                    onChange={(e) => setFacebook(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border-custom bg-bg-app text-text-main outline-none focus:ring-1 focus:ring-text-main focus:border-text-main transition-all placeholder:text-text-muted/40 font-semibold"
                    placeholder="username"
                  />
                </div>

                <div>
                  <label
                    htmlFor={instagramId}
                    className="block text-2xs font-bold uppercase tracking-widest mb-1 text-text-muted select-none"
                  >
                    Instagram
                  </label>
                  <input
                    id={instagramId}
                    type="text"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border-custom bg-bg-app text-text-main outline-none focus:ring-1 focus:ring-text-main focus:border-text-main transition-all placeholder:text-text-muted/40 font-semibold"
                    placeholder="username"
                  />
                </div>

                <div>
                  <label
                    htmlFor={linkedinId}
                    className="block text-2xs font-bold uppercase tracking-widest mb-1 text-text-muted select-none"
                  >
                    LinkedIn
                  </label>
                  <input
                    id={linkedinId}
                    type="text"
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border-custom bg-bg-app text-text-main outline-none focus:ring-1 focus:ring-text-main focus:border-text-main transition-all placeholder:text-text-muted/40 font-semibold"
                    placeholder="username"
                  />
                </div>

                <div>
                  <label
                    htmlFor={mastodonId}
                    className="block text-2xs font-bold uppercase tracking-widest mb-1 text-text-muted select-none"
                  >
                    Mastodon
                  </label>
                  <input
                    id={mastodonId}
                    type="text"
                    value={mastodon}
                    onChange={(e) => setMastodon(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border-custom bg-bg-app text-text-main outline-none focus:ring-1 focus:ring-text-main focus:border-text-main transition-all placeholder:text-text-muted/40 font-semibold"
                    placeholder="username@server.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor={blueskyId}
                    className="block text-2xs font-bold uppercase tracking-widest mb-1 text-text-muted select-none"
                  >
                    Bluesky
                  </label>
                  <input
                    id={blueskyId}
                    type="text"
                    value={bluesky}
                    onChange={(e) => setBluesky(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border-custom bg-bg-app text-text-main outline-none focus:ring-1 focus:ring-text-main focus:border-text-main transition-all placeholder:text-text-muted/40 font-semibold"
                    placeholder="username"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-6 px-6 py-2.5 rounded-lg bg-text-main text-bg-card font-bold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 cursor-pointer select-none"
              >
                <Lock className="w-4.5 h-4.5" />
                {loading ? 'Saving Changes...' : 'Save Socials'}
              </button>
            </form>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="mb-4">
                <h3 className="text-sm font-black text-text-main mb-1 select-none">
                  Change Password
                </h3>
                <p className="text-3xs text-text-muted select-none">
                  Keep your login credentials secure.
                </p>
              </div>

              <div>
                <label
                  htmlFor={currentPasswordId}
                  className="block text-2xs font-bold uppercase tracking-widest mb-1 text-text-muted select-none"
                >
                  Current Password
                </label>
                <input
                  id={currentPasswordId}
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border-custom bg-bg-app text-text-main outline-none focus:ring-1 focus:ring-text-main focus:border-text-main transition-all placeholder:text-text-muted/40 font-semibold"
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label
                  htmlFor={newPasswordId}
                  className="block text-2xs font-bold uppercase tracking-widest mb-1 text-text-muted select-none"
                >
                  New Password
                </label>
                <input
                  id={newPasswordId}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border-custom bg-bg-app text-text-main outline-none focus:ring-1 focus:ring-text-main focus:border-text-main transition-all placeholder:text-text-muted/40 font-semibold"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label
                  htmlFor={confirmPasswordId}
                  className="block text-2xs font-bold uppercase tracking-widest mb-1 text-text-muted select-none"
                >
                  Confirm New Password
                </label>
                <input
                  id={confirmPasswordId}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border-custom bg-bg-app text-text-main outline-none focus:ring-1 focus:ring-text-main focus:border-text-main transition-all placeholder:text-text-muted/40 font-semibold"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-6 px-6 py-2.5 rounded-lg bg-text-main text-bg-card font-bold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 cursor-pointer select-none"
              >
                <Lock className="w-4.5 h-4.5" />
                {loading ? 'Saving Changes...' : 'Save Password'}
              </button>
            </form>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-4">
              <div className="mb-4">
                <h3 className="text-sm font-black text-text-main mb-1 select-none">
                  Editor Preferences
                </h3>
                <p className="text-3xs text-text-muted select-none">
                  Configure customized editing options.
                </p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-border-custom bg-bg-app">
                <div>
                  <label
                    htmlFor={autoSaveToggleId}
                    className="text-xs font-bold text-text-main select-none block"
                  >
                    Auto Save Drafts
                  </label>
                  <p className="text-3xs text-text-muted select-none">
                    Automatically save changes to the database every 1.5 seconds.
                  </p>
                </div>
                <input
                  id={autoSaveToggleId}
                  type="checkbox"
                  checked={autoSave}
                  onChange={handleAutoSaveToggle}
                  className="w-4.5 h-4.5 text-text-main border-border-custom rounded focus:ring-text-main accent-text-main cursor-pointer"
                />
              </div>
            </div>
          )}

          {activeTab === 'portability' && (
            <div className="space-y-4">
              <div className="mb-4">
                <h3 className="text-sm font-black text-text-main mb-1 select-none">
                  Backup & Data Portability
                </h3>
                <p className="text-3xs text-text-muted select-none">
                  Export database records to a backup file or import existing documents.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  id={markdownImportFileId}
                  name="markdownImportFile"
                  type="file"
                  accept=".md"
                  ref={importInputRef}
                  onChange={handleImportChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handleImportClick}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-border-custom bg-bg-app hover:bg-border-custom/30 text-text-main text-xs font-bold transition-all cursor-pointer select-none"
                >
                  <Upload className="w-4 h-4 text-text-muted" />
                  Import Markdown
                </button>

                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-border-custom bg-bg-app hover:bg-border-custom/30 text-text-main text-xs font-bold transition-all cursor-pointer select-none"
                >
                  <Download className="w-4 h-4 text-text-muted" />
                  Backup Data
                </button>

                <input
                  id={backupRestoreFileId}
                  name="backupRestoreFile"
                  type="file"
                  accept=".zip"
                  ref={restoreInputRef}
                  onChange={handleRestoreChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handleRestoreClick}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-border-custom bg-bg-app hover:bg-border-custom/30 text-text-main text-xs font-bold transition-all cursor-pointer select-none"
                >
                  <Database className="w-4 h-4 text-text-muted" />
                  Restore Backup
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
