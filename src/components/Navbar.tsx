import React, { useEffect, useId, useState } from 'react';
import { useDocs } from '@/components/DocContext';
import {
  Check,
  Copy,
  FileDown,
  FileJson,
  Globe,
  Lock,
  Menu,
  Moon,
  Printer,
  Save,
  Sun,
} from '@/components/Icons';
import { config } from '@/utils/config';

const EyeOffIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </svg>
);

export default function Navbar() {
  const { activeDoc, updateActiveDocument, saving, setSidebarOpen } = useDocs();

  const documentTitleId = `${useId().replace(/:/g, '')}-document-title`;
  const [copied, setCopied] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [ownerUsername, setOwnerUsername] = useState<string>('');

  // Load active theme
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
      setCurrentTheme(savedTheme);
    }
  }, []);

  // Fetch current user's username for share URL
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.username) setOwnerUsername(data.username);
      })
      .catch(() => {});
  }, []);

  // Toggle Theme (Light <-> OLED Dark)
  const cycleTheme = () => {
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';

    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(nextTheme);
    localStorage.setItem('theme', nextTheme);
    setCurrentTheme(nextTheme);
  };

  if (!activeDoc) {
    return (
      <nav className="relative z-20 h-14 bg-bg-card border-b border-border-custom flex items-center justify-between px-4 no-print select-none">
        {/* Left: Hamburger + Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg border border-border-custom hover:bg-border-custom/25 text-text-main shrink-0 cursor-pointer"
            aria-label="Open Menu"
          >
            <Menu className="w-4 h-4" />
          </button>
          <span className="font-extrabold tracking-wider text-sm text-text-main uppercase truncate">
            {config.appName}
          </span>
        </div>

        {/* Right: Theme Toggler */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={cycleTheme}
            className="p-2 rounded-lg border border-border-custom hover:bg-border-custom/25 text-text-muted hover:text-text-main transition-all bg-bg-card"
            title={`Theme: ${currentTheme === 'light' ? 'Light' : 'Dark (OLED)'}`}
            aria-label="Change Theme"
          >
            {currentTheme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </nav>
    );
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateActiveDocument({ title: e.target.value });
  };

  // Save title on blur or enter key
  const saveTitle = async () => {
    try {
      await fetch(`/api/documents/${activeDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: activeDoc.title }),
      });
    } catch (error) {
      console.error('Failed to save title:', error);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  // Visibility toggle
  const updateVisibility = async (newVisibility: 'private' | 'public' | 'unlisted') => {
    updateActiveDocument({ visibility: newVisibility });
    setDropdownOpen(false);

    try {
      const res = await fetch(`/api/documents/${activeDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility }),
      });
      if (res.ok) {
        const data = await res.json();
        const updatedDoc = data.document;

        if (newVisibility === 'public' && updatedDoc.visibility === 'unlisted') {
          alert(
            'This document is inside a Private folder, so its visibility was set to Unlisted instead of Public.',
          );
        }

        updateActiveDocument({
          visibility: updatedDoc.visibility,
          isPublic: updatedDoc.isPublic,
        });
      }
    } catch (error) {
      console.error('Failed to update visibility:', error);
    }
  };

  // Copy share URL — canonical /{username}/documents/{slug or id}
  const copyShareUrl = () => {
    if (typeof window !== 'undefined') {
      const base = window.location.origin;
      const docIdentifier = activeDoc.customSlug || activeDoc.id;
      const shareUrl = ownerUsername
        ? `${base}/${ownerUsername}/documents/${docIdentifier}`
        : `${base}/shared/doc/${activeDoc.id}`; // fallback while username loads
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Export to Markdown (.md)
  const exportMarkdown = () => {
    const blob = new Blob([activeDoc.content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeDoc.title || 'Untitled'}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to JSON
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(activeDoc, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeDoc.title || 'Untitled'}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print PDF
  const triggerPrint = () => {
    window.print();
  };

  return (
    <nav className="relative z-20 flex h-14 items-center justify-between border-b border-border-custom bg-bg-card px-2 sm:px-4 no-print select-none">
      {/* Left: Hamburger + Title */}
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden p-2 rounded-lg border border-border-custom hover:bg-border-custom/25 text-text-main shrink-0 cursor-pointer"
          aria-label="Open Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            id={documentTitleId}
            name="documentTitle"
            type="text"
            value={activeDoc.title}
            onChange={handleTitleChange}
            onBlur={saveTitle}
            onKeyDown={handleTitleKeyDown}
            className="w-full min-w-0 max-w-44 rounded border-b border-transparent bg-transparent px-1 py-0.5 text-sm font-bold text-text-main outline-none transition-colors focus:border-text-main sm:min-w-37.5 sm:max-w-75"
            title="Edit document title"
            placeholder="Untitled Document"
          />
          {saving ? (
            <span className="flex shrink-0 items-center gap-1 rounded bg-border-custom/30 px-1.5 py-0.5 text-3xs text-text-muted">
              <Save className="w-2.5 h-2.5 animate-pulse" />
              <span className="hidden sm:inline">Saving...</span>
            </span>
          ) : (
            <span className="hidden shrink-0 select-none text-3xs text-text-muted/60 sm:inline">
              Saved
            </span>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="ml-2 flex shrink-0 items-center gap-1 sm:ml-4 sm:gap-1.5">
        {/* Visibility share controller */}
        <div className="flex items-center border border-border-custom rounded-lg bg-bg-app p-0.5 relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-text-muted hover:text-text-main transition-all cursor-pointer"
            title="Change Document Visibility"
          >
            {activeDoc.visibility === 'public' ? (
              <>
                <Globe className="w-3.5 h-3.5 text-text-main" />
                <span className="hidden sm:inline text-text-main">Public</span>
              </>
            ) : activeDoc.visibility === 'unlisted' ? (
              <>
                <EyeOffIcon className="w-3.5 h-3.5 text-text-main" />
                <span className="hidden sm:inline text-text-main">Unlisted</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Private</span>
              </>
            )}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3 h-3 opacity-60"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />

              <div className="absolute right-0 mt-1 top-full w-56 rounded-xl border border-border-custom bg-bg-card shadow-2xl p-1.5 z-40 space-y-0.5 select-none">
                <button
                  onClick={() => updateVisibility('private')}
                  className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-all cursor-pointer ${
                    activeDoc.visibility === 'private' ||
                    (!activeDoc.visibility && !activeDoc.isPublic)
                      ? 'bg-border-custom/40 text-text-main font-semibold'
                      : 'hover:bg-border-custom/20 text-text-muted hover:text-text-main'
                  }`}
                >
                  <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold">Private</p>
                    <p className="text-3xs text-text-muted leading-tight mt-0.5">
                      Only you can see this document.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => updateVisibility('public')}
                  className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-all cursor-pointer ${
                    activeDoc.visibility === 'public'
                      ? 'bg-border-custom/40 text-text-main font-semibold'
                      : 'hover:bg-border-custom/20 text-text-muted hover:text-text-main'
                  }`}
                >
                  <Globe className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold">Public</p>
                    <p className="text-3xs text-text-muted leading-tight mt-0.5">
                      Indexable by search engines, shown on profile.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => updateVisibility('unlisted')}
                  className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-all cursor-pointer ${
                    activeDoc.visibility === 'unlisted'
                      ? 'bg-border-custom/40 text-text-main font-semibold'
                      : 'hover:bg-border-custom/20 text-text-muted hover:text-text-main'
                  }`}
                >
                  <EyeOffIcon className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold">Unlisted</p>
                    <p className="text-3xs text-text-muted leading-tight mt-0.5">
                      Link access only, hidden from search engines.
                    </p>
                  </div>
                </button>
              </div>
            </>
          )}

          {(activeDoc.visibility === 'public' ||
            activeDoc.visibility === 'unlisted' ||
            activeDoc.isPublic) && (
            <button
              onClick={copyShareUrl}
              className="p-1 px-2 rounded-md hover:bg-border-custom/30 text-text-muted hover:text-text-main transition-all flex items-center gap-1 ml-0.5 cursor-pointer border-l border-border-custom"
              title="Copy public link"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-3xs text-green-500 font-bold hidden sm:inline">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-3xs hidden sm:inline font-bold">Copy</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Dropdown / Export Actions */}
        <div className="flex items-center border border-border-custom rounded-lg bg-bg-app p-0.5 relative">
          {/* Desktop/Tablet: Separate Buttons */}
          <div className="hidden sm:flex items-center">
            <button
              onClick={exportMarkdown}
              className="p-1.5 rounded-md hover:bg-border-custom/35 text-text-muted hover:text-text-main transition-all"
              title="Export as Markdown (.md)"
              aria-label="Export MD"
            >
              <FileDown className="w-4 h-4" />
            </button>
            <button
              onClick={exportJson}
              className="p-1.5 rounded-md hover:bg-border-custom/35 text-text-muted hover:text-text-main transition-all"
              title="Export as JSON (.json)"
              aria-label="Export JSON"
            >
              <FileJson className="w-4 h-4" />
            </button>
            <button
              onClick={triggerPrint}
              className="p-1.5 rounded-md hover:bg-border-custom/35 text-text-muted hover:text-text-main transition-all"
              title="Print / PDF (A4 Layout)"
              aria-label="Print PDF"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile: Export Dropdown Button */}
          <div className="sm:hidden relative flex items-center">
            <button
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              className="p-1.5 rounded-md hover:bg-border-custom/35 text-text-muted hover:text-text-main transition-all flex items-center justify-center cursor-pointer"
              title="Export options"
              aria-label="Export Menu"
            >
              <FileDown className="w-4 h-4" />
            </button>

            {exportDropdownOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setExportDropdownOpen(false)} />
                <div className="absolute right-0 mt-1 top-full w-40 rounded-xl border border-border-custom bg-bg-card shadow-2xl p-1.5 z-40 space-y-0.5 select-none">
                  <button
                    onClick={() => {
                      exportMarkdown();
                      setExportDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs text-text-muted hover:bg-border-custom/20 hover:text-text-main transition-all cursor-pointer font-semibold"
                  >
                    <FileDown className="w-4 h-4 shrink-0" />
                    <span>Export MD</span>
                  </button>
                  <button
                    onClick={() => {
                      exportJson();
                      setExportDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs text-text-muted hover:bg-border-custom/20 hover:text-text-main transition-all cursor-pointer font-semibold"
                  >
                    <FileJson className="w-4 h-4 shrink-0" />
                    <span>Export JSON</span>
                  </button>
                  <button
                    onClick={() => {
                      triggerPrint();
                      setExportDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs text-text-muted hover:bg-border-custom/20 hover:text-text-main transition-all cursor-pointer font-semibold"
                  >
                    <Printer className="w-4 h-4 shrink-0" />
                    <span>Print PDF</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Theme Toggler */}
        <button
          onClick={cycleTheme}
          className="p-2 rounded-lg border border-border-custom hover:bg-border-custom/25 text-text-muted hover:text-text-main transition-all bg-bg-card"
          title={`Theme: ${currentTheme === 'light' ? 'Light' : 'Dark (OLED)'}`}
          aria-label="Change Theme"
        >
          {currentTheme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </div>
    </nav>
  );
}
