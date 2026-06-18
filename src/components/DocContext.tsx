import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface DocMetadata {
  id: string;
  userId: string;
  folderId: string | null;
  title: string;
  isPublic: boolean;
  visibility: string;
  description: string | null;
  tags: string | null;
  customSlug: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail extends DocMetadata {
  content: string;
}

export interface Folder {
  id: string;
  userId: string;
  name: string;
  parentId: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DocContextType {
  documents: DocMetadata[];
  folders: Folder[];
  activeDoc: DocumentDetail | null;
  loading: boolean;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  loadDocuments: () => Promise<void>;
  loadFolders: () => Promise<void>;
  selectDocument: (id: string) => Promise<void>;
  createDocument: (folderId?: string | null) => Promise<string | null>;
  updateActiveDocument: (fields: Partial<DocumentDetail>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  createFolder: (name: string, parentId?: string | null, isPublic?: boolean) => Promise<void>;
  updateFolder: (id: string, fields: Partial<Folder>) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  moveDocument: (docId: string, folderId: string | null) => Promise<void>;
  moveFolder: (folderId: string, parentId: string | null) => Promise<void>;
  importMarkdown: (file: File) => Promise<void>;
  restoreBackup: (file: File) => Promise<void>;
  logout: () => Promise<void>;
}

const DocContext = createContext<DocContextType | undefined>(undefined);

export function DocProvider({
  children,
  activeDocId,
}: {
  children: React.ReactNode;
  activeDocId?: string;
}) {
  const [documents, setDocuments] = useState<DocMetadata[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeDoc, setActiveDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Load documents
  const loadDocuments = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  }, []);

  // Load folders
  const loadFolders = useCallback(async () => {
    try {
      const res = await fetch('/api/folders');
      if (res.ok) {
        const data = await res.json();
        setFolders(data);
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  }, []);

  // Fetch individual document
  const selectDocument = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveDoc(data);
      }
    } catch (error) {
      console.error('Failed to fetch document details:', error);
    }
  }, []);

  // Create document
  const createDocument = useCallback(
    async (folderId: string | null = null) => {
      try {
        const res = await fetch('/api/documents', { method: 'POST' });
        if (res.ok) {
          const newDoc = await res.json();

          // If created inside a folder, update folderId right away
          if (folderId) {
            newDoc.folderId = folderId;
            await fetch(`/api/documents/${newDoc.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ folderId }),
            });
          }

          await loadDocuments();
          return newDoc.id;
        }
      } catch (error) {
        console.error('Failed to create document:', error);
      }
      return null;
    },
    [loadDocuments],
  );

  // Update active document locally
  const updateActiveDocument = useCallback(
    async (fields: Partial<DocumentDetail>) => {
      if (!activeDoc) return;

      setActiveDoc((prev) => {
        if (!prev) return null;
        return { ...prev, ...fields } as DocumentDetail;
      });

      if (
        fields.title !== undefined ||
        fields.isPublic !== undefined ||
        fields.visibility !== undefined ||
        fields.folderId !== undefined ||
        fields.description !== undefined ||
        fields.tags !== undefined ||
        fields.customSlug !== undefined
      ) {
        setDocuments((prev) =>
          prev.map((doc) => {
            if (doc.id === activeDoc.id) {
              const finalVisibility =
                fields.visibility !== undefined ? fields.visibility : doc.visibility;
              const finalIsPublic =
                fields.isPublic !== undefined
                  ? fields.isPublic
                  : fields.visibility !== undefined
                    ? fields.visibility === 'public' || fields.visibility === 'unlisted'
                    : doc.isPublic;

              return {
                ...doc,
                title: fields.title ?? doc.title,
                visibility: finalVisibility,
                isPublic: finalIsPublic,
                folderId: fields.folderId !== undefined ? fields.folderId : doc.folderId,
                description:
                  fields.description !== undefined ? fields.description : doc.description,
                tags: fields.tags !== undefined ? fields.tags : doc.tags,
                customSlug: fields.customSlug !== undefined ? fields.customSlug : doc.customSlug,
                updatedAt: new Date().toISOString(),
              };
            }
            return doc;
          }),
        );
      }
    },
    [activeDoc],
  );

  // Delete document
  const deleteDocument = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setDocuments((prev) => prev.filter((doc) => doc.id !== id));
          if (activeDoc?.id === id) {
            setActiveDoc(null);
          }
        }
      } catch (error) {
        console.error('Failed to delete document:', error);
      }
    },
    [activeDoc],
  );

  // Create folder
  const createFolder = useCallback(
    async (name: string, parentId: string | null = null, isPublic = false) => {
      try {
        const res = await fetch('/api/folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, parentId, isPublic }),
        });
        if (res.ok) {
          await loadFolders();
        }
      } catch (error) {
        console.error('Failed to create folder:', error);
      }
    },
    [loadFolders],
  );

  // Update folder
  const updateFolder = useCallback(
    async (id: string, fields: Partial<Folder>) => {
      try {
        const res = await fetch(`/api/folders/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fields),
        });
        if (res.ok) {
          await loadFolders();
          await loadDocuments(); // Reload documents because visibility might have cascaded!
        } else {
          const errData = await res.json();
          alert(errData.error || 'Failed to update folder');
        }
      } catch (error) {
        console.error('Failed to update folder:', error);
      }
    },
    [loadFolders, loadDocuments],
  );

  // Delete folder
  const deleteFolder = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/folders/${id}`, { method: 'DELETE' });
        if (res.ok) {
          await loadFolders();
          await loadDocuments(); // In case documents were moved to Root
        }
      } catch (error) {
        console.error('Failed to delete folder:', error);
      }
    },
    [loadFolders, loadDocuments],
  );

  // Move document to folder
  const moveDocument = useCallback(
    async (docId: string, folderId: string | null) => {
      try {
        const res = await fetch(`/api/documents/${docId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderId }),
        });
        if (res.ok) {
          const data = await res.json();
          const updatedDoc = data.document;
          setDocuments((prev) =>
            prev.map((doc) =>
              doc.id === docId
                ? {
                    ...doc,
                    folderId,
                    visibility: updatedDoc.visibility,
                    isPublic: updatedDoc.isPublic,
                    updatedAt: updatedDoc.updatedAt,
                  }
                : doc,
            ),
          );
          if (activeDoc?.id === docId) {
            setActiveDoc((prev) =>
              prev
                ? {
                    ...prev,
                    folderId,
                    visibility: updatedDoc.visibility,
                    isPublic: updatedDoc.isPublic,
                    updatedAt: updatedDoc.updatedAt,
                  }
                : null,
            );
          }
        }
      } catch (error) {
        console.error('Failed to move document:', error);
      }
    },
    [activeDoc],
  );

  // Move folder to another folder
  const moveFolder = useCallback(
    async (folderId: string, parentId: string | null) => {
      await updateFolder(folderId, { parentId });
    },
    [updateFolder],
  );

  // Import Markdown
  const importMarkdown = useCallback(
    async (file: File) => {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/documents/import-markdown', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          await loadDocuments();
          window.location.href = `/documents/${data.docId}`;
        }
      } catch (error) {
        console.error('Failed to import markdown:', error);
      }
    },
    [loadDocuments],
  );

  // Restore Backup
  const restoreBackup = useCallback(
    async (file: File) => {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/documents/backup', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          await loadDocuments();
          await loadFolders();
          window.location.href = '/documents';
        } else {
          const errData = await res.json();
          alert(errData.error || 'Failed to restore backup');
        }
      } catch (error) {
        console.error('Failed to restore backup:', error);
      }
    },
    [loadDocuments, loadFolders],
  );

  // Logout
  const logout = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    Promise.all([loadDocuments(), loadFolders()]).then(() => {
      setLoading(false);
    });
  }, [loadDocuments, loadFolders]);

  // Load active document details if activeDocId changes
  useEffect(() => {
    if (activeDocId) {
      selectDocument(activeDocId);
    } else {
      setActiveDoc(null);
    }
  }, [activeDocId, selectDocument]);

  return (
    <DocContext.Provider
      value={{
        documents,
        folders,
        activeDoc,
        loading,
        saving,
        setSaving,
        sidebarOpen,
        setSidebarOpen,
        loadDocuments,
        loadFolders,
        selectDocument,
        createDocument,
        updateActiveDocument,
        deleteDocument,
        createFolder,
        updateFolder,
        deleteFolder,
        moveDocument,
        moveFolder,
        importMarkdown,
        restoreBackup,
        logout,
      }}
    >
      {children}
    </DocContext.Provider>
  );
}

export function useDocs() {
  const context = useContext(DocContext);
  if (context === undefined) {
    throw new Error('useDocs must be used within a DocProvider');
  }
  return context;
}
export { DocContext };
