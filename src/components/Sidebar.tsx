import React, { useEffect, useState } from 'react';
import { type DocMetadata, type Folder, useDocs } from '@/components/DocContext';
import {
  ChevronDown,
  ChevronRight,
  Edit,
  FileText,
  Folder as FolderIcon,
  FolderOpen,
  FolderPlus,
  Globe,
  Lock,
  LogOut,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from '@/components/Icons';
import { config } from '@/utils/config';

export default function Sidebar() {
  const {
    documents,
    folders,
    activeDoc,
    createDocument,
    deleteDocument,
    createFolder,
    updateFolder,
    deleteFolder,
    moveDocument,
    moveFolder,
    logout,
    sidebarOpen,
    setSidebarOpen,
  } = useDocs();

  const [search, setSearch] = useState('');
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [profileName, setProfileName] = useState('User');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setProfileName(data.name || data.username);
        }
      } catch (e) {
        console.error('Failed to fetch user profile:', e);
      }
    };
    fetchProfile();
  }, []);

  const filteredDocs = documents.filter((doc) =>
    doc.title.toLowerCase().includes(search.toLowerCase()),
  );

  const filteredFolders = folders.filter((folder) =>
    folder.name.toLowerCase().includes(search.toLowerCase()),
  );

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent, type: 'document' | 'folder', id: string) => {
    e.dataTransfer.setData('application/monodoc-type', type);
    e.dataTransfer.setData('application/monodoc-id', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/monodoc-type');
    const id = e.dataTransfer.getData('application/monodoc-id');
    if (!id) return;

    if (type === 'document') {
      await moveDocument(id, targetFolderId);
    } else if (type === 'folder') {
      if (id === targetFolderId) return;
      await moveFolder(id, targetFolderId);
    }
  };

  // Actions
  const handleCreateDoc = async (folderId: string | null = null) => {
    const newId = await createDocument(folderId);
    if (newId) {
      window.location.href = `/documents/${newId}`;
    }
  };

  const handleCreateRootFolder = async () => {
    const name = prompt('Enter folder name:');
    if (name && name.trim()) {
      const isPublic = confirm(
        'Make this folder Public?\n\n- Click OK to make it Public (indexable, public documents).\n- Click Cancel to make it Private.',
      );
      await createFolder(name.trim(), null, isPublic);
    }
  };

  const handleCreateFolderInFolder = async (parentFolderId: string) => {
    const name = prompt('Enter subfolder name:');
    if (name && name.trim()) {
      const isPublic = confirm(
        'Make this folder Public?\n\n- Click OK to make it Public (indexable, public documents).\n- Click Cancel to make it Private.',
      );
      await createFolder(name.trim(), parentFolderId, isPublic);
    }
  };

  const handleRenameFolder = async (folder: Folder) => {
    const name = prompt('Rename folder:', folder.name);
    if (name !== null) {
      const newName = name.trim();
      const isPublic = confirm(
        `Make folder "${newName || folder.name}" Public?\n\n- Click OK to make it Public.\n- Click Cancel to make it Private.`,
      );

      const updates: Partial<Folder> = { isPublic };
      if (newName && newName !== folder.name) {
        updates.name = newName;
      }
      await updateFolder(folder.id, updates);
    }
  };

  const handleDeleteFolderClick = async (folder: Folder) => {
    if (
      confirm(
        `Are you sure you want to delete folder "${folder.name}"? Subfolders will be deleted, and documents inside will be moved to the Root directory (reverting to 'unlisted' if they were 'public').`,
      )
    ) {
      await deleteFolder(folder.id);
    }
  };

  // Recursive Tree Rendering
  const renderDocNode = (doc: DocMetadata, level = 0) => {
    const isActive = activeDoc?.id === doc.id;
    return (
      <a
        href={`/documents/${doc.id}`}
        key={doc.id}
        draggable
        onDragStart={(e) => handleDragStart(e, 'document', doc.id)}
        className={`group flex items-center justify-between p-2 rounded-lg text-sm transition-all cursor-pointer ${
          isActive ? 'bg-text-main text-bg-card font-semibold' : 'hover:bg-border-custom/25'
        }`}
        style={{ paddingLeft: `${Math.max(8, level * 16)}px` }}
        onClick={() => {
          setSidebarOpen(false);
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <FileText
            className={`w-4 h-4 shrink-0 ${isActive ? 'text-bg-card' : 'text-text-muted'}`}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs">{doc.title || 'Untitled Document'}</p>
            <p
              className={`text-3xs mt-0.5 truncate ${isActive ? 'text-bg-card/70' : 'text-text-muted/70'}`}
            >
              {formatDate(doc.updatedAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {doc.isPublic ? (
            <span title="Public">
              <Globe className={`w-3.5 h-3.5 ${isActive ? 'text-bg-card' : 'text-text-muted'}`} />
            </span>
          ) : (
            <span title="Private">
              <Lock
                className={`w-3.5 h-3.5 ${isActive ? 'text-bg-card/50' : 'text-text-muted/30'}`}
              />
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (confirm(`Delete document "${doc.title || 'Untitled Document'}"?`)) {
                deleteDocument(doc.id);
              }
            }}
            className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
              isActive
                ? 'hover:bg-bg-card/20 text-bg-card'
                : 'hover:bg-border-custom/50 text-text-muted hover:text-red-500'
            }`}
            aria-label="Delete document"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </a>
    );
  };

  const renderFolderNode = (folder: Folder, level = 0) => {
    const isExpanded = !!expandedFolders[folder.id];
    const childFolders = folders.filter((f) => f.parentId === folder.id);
    const childDocs = documents.filter((d) => d.folderId === folder.id);
    const isHoveredDrop = dragOverFolderId === folder.id;

    return (
      <div key={folder.id} className="space-y-0.5">
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, 'folder', folder.id)}
          onDragOver={(e) => {
            handleDragOver(e);
            setDragOverFolderId(folder.id);
          }}
          onDragLeave={() => setDragOverFolderId(null)}
          onDrop={(e) => {
            setDragOverFolderId(null);
            handleDrop(e, folder.id);
          }}
          className={`group flex items-center justify-between p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
            isHoveredDrop
              ? 'bg-border-custom text-text-main'
              : 'hover:bg-border-custom/20 text-text-main'
          }`}
          style={{ paddingLeft: `${Math.max(8, level * 16)}px` }}
        >
          <div
            className="flex items-center gap-1.5 min-w-0 flex-1"
            onClick={() => toggleFolder(folder.id)}
          >
            <div className="p-0.5 rounded hover:bg-border-custom/30 text-text-muted shrink-0">
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </div>
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 shrink-0 text-text-main" />
            ) : (
              <FolderIcon className="w-4 h-4 shrink-0 text-text-muted" />
            )}
            <span className="truncate font-semibold flex-1 text-left">{folder.name}</span>
            {folder.isPublic ? (
              <span title="Public Folder" className="shrink-0 mr-1.5 opacity-60">
                <Globe className="w-3 h-3 text-text-muted" />
              </span>
            ) : (
              <span title="Private Folder" className="shrink-0 mr-1.5 opacity-25">
                <Lock className="w-3 h-3 text-text-muted" />
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
            <button
              onClick={() => handleCreateDoc(folder.id)}
              title="New document in folder"
              className="p-0.5 rounded hover:bg-border-custom/50 text-text-muted hover:text-text-main"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleCreateFolderInFolder(folder.id)}
              title="New subfolder"
              className="p-0.5 rounded hover:bg-border-custom/50 text-text-muted hover:text-text-main"
            >
              <FolderPlus className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleRenameFolder(folder)}
              title="Rename folder"
              className="p-0.5 rounded hover:bg-border-custom/50 text-text-muted hover:text-text-main"
            >
              <Edit className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleDeleteFolderClick(folder)}
              title="Delete folder"
              className="p-0.5 rounded hover:bg-border-custom/50 text-text-muted hover:text-red-500"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="space-y-0.5">
            {childFolders.map((child) => renderFolderNode(child, level + 1))}
            {childDocs.map((doc) => renderDocNode(doc, level + 1))}
            {childFolders.length === 0 && childDocs.length === 0 && (
              <div
                className="text-3xs text-text-muted/40 italic"
                style={{ paddingLeft: `${(level + 1) * 16 + 24}px` }}
              >
                Empty folder
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const rootFolders = folders.filter((f) => !f.parentId);
  const rootDocs = documents.filter((d) => !d.folderId);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-bg-card border-r border-border-custom text-text-main">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-custom/60">
        <div className="flex items-center gap-2 min-w-0">
          {config.appLogo ? (
            <img src={config.appLogo} alt={config.appName} className="w-6 h-6 object-contain" />
          ) : (
            <div className="w-6 h-6 rounded bg-text-main flex items-center justify-center text-bg-card font-black text-sm shrink-0">
              {config.appName.substring(0, 1).toUpperCase()}
            </div>
          )}
          <span className="font-extrabold tracking-wider text-lg truncate">
            {config.appName.toUpperCase()}
          </span>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden p-1.5 rounded hover:bg-bg-app text-text-muted hover:text-text-main"
          aria-label="Close Menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Action Buttons */}
      <div className="p-4 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleCreateDoc(null)}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-text-main text-bg-card font-bold hover:opacity-90 transition-all text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Doc
          </button>
          <button
            onClick={handleCreateRootFolder}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-border-custom bg-bg-app hover:bg-border-custom/25 text-text-main font-bold transition-all text-xs cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            New Folder
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="px-4 mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-text-muted/50" />
          <input
            name="documentSearch"
            type="text"
            aria-label="Search documents"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border-custom bg-bg-app text-text-main text-xs outline-none focus:border-text-main transition-colors placeholder:text-text-muted/40"
          />
        </div>
      </div>

      {/* Root Drop Target */}
      <div className="px-4 mb-2">
        <div
          onDragOver={(e) => {
            handleDragOver(e);
            setIsDragOverRoot(true);
          }}
          onDragLeave={() => setIsDragOverRoot(false)}
          onDrop={(e) => {
            setIsDragOverRoot(false);
            handleDrop(e, null);
          }}
          className={`p-2 border border-dashed rounded-lg text-center text-xs transition-all flex items-center justify-center gap-1.5 ${
            isDragOverRoot
              ? 'border-text-main bg-border-custom/20 text-text-main font-semibold'
              : 'border-border-custom/50 text-text-muted hover:border-text-main/50 hover:text-text-main'
          }`}
        >
          <span className="text-3xs font-bold uppercase tracking-wider">
            Drop here to move to Root
          </span>
        </div>
      </div>

      {/* Tree / Search Results */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {search ? (
          <div className="space-y-4">
            {filteredFolders.length > 0 && (
              <div>
                <h3 className="px-2 text-3xs font-bold uppercase tracking-wider text-text-muted mb-1">
                  Folders
                </h3>
                <div className="space-y-0.5">
                  {filteredFolders.map((folder) => (
                    <div
                      key={folder.id}
                      className="flex items-center justify-between p-2 rounded-lg text-sm hover:bg-border-custom/25 cursor-pointer text-text-main"
                      onClick={() => toggleFolder(folder.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FolderIcon className="w-4 h-4 shrink-0 text-text-muted" />
                        <span className="truncate text-xs font-semibold">{folder.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="px-2 text-3xs font-bold uppercase tracking-wider text-text-muted mb-1">
                Documents
              </h3>
              {filteredDocs.length === 0 ? (
                <div className="py-4 text-center text-xs text-text-muted/60">
                  No documents found
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredDocs.map((doc) => renderDocNode(doc, 0))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Folder and document tree */
          <div className="space-y-1">
            {rootFolders.map((folder) => renderFolderNode(folder, 0))}
            {rootDocs.map((doc) => renderDocNode(doc, 0))}
            {rootFolders.length === 0 && rootDocs.length === 0 && (
              <div className="py-8 text-center text-xs text-text-muted/60">
                No documents or folders
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sidebar Footer / User Profile & Settings */}
      <div className="p-4 border-t border-border-custom/60 flex items-center justify-between">
        <div className="flex flex-col min-w-0">
          <span className="text-2xs font-bold uppercase tracking-wider text-text-muted">User</span>
          <span className="text-xs font-semibold truncate">{profileName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <a
            href="/documents/settings"
            className="p-2 rounded-lg border border-border-custom hover:bg-border-custom/25 text-text-muted hover:text-text-main transition-all"
            title="Account Settings"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </a>
          <button
            onClick={logout}
            className="p-2 rounded-lg border border-border-custom hover:bg-border-custom/25 text-text-muted hover:text-text-main transition-all cursor-pointer"
            title="Log Out"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 lg:w-72 shrink-0 h-screen no-print">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden no-print">
          <div
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
          />
          <div className="absolute top-0 bottom-0 left-0 w-64 max-w-[80vw]">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
