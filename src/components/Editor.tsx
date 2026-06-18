import Image from '@tiptap/extension-image';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useId, useRef, useState } from 'react';
import { Markdown } from 'tiptap-markdown';
import { useDocs } from '@/components/DocContext';
import {
  AlertTriangle,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  History,
  ImageIcon,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo,
  Save,
  Settings,
  Sparkles,
  Strikethrough,
  Terminal,
  Undo,
  Upload,
  X,
} from '@/components/Icons';

type ImageUploadConfig = {
  uploadsEnabled: boolean;
  maxBytes: number;
};

type FormSubmitEvent = {
  preventDefault: () => void;
};

const DEFAULT_IMAGE_QUALITY = 82;
const DEFAULT_IMAGE_MAX_EDGE = 1920;
const MIN_IMAGE_EDGE = 640;
const MAX_IMAGE_EDGE = 2560;
const IMAGE_EDGE_STEP = 160;

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
};

export default function Editor() {
  const fieldIdPrefix = useId().replace(/:/g, '');
  const imageUploadFileId = `${fieldIdPrefix}-document-image-upload-file`;
  const imageUploadAltId = `${fieldIdPrefix}-document-image-upload-alt`;
  const imageQualityId = `${fieldIdPrefix}-image-quality`;
  const imageMaxEdgeId = `${fieldIdPrefix}-image-max-edge`;
  const imageUrlAltId = `${fieldIdPrefix}-document-image-url-alt`;
  const imageUrlId = `${fieldIdPrefix}-document-image-url`;
  const customSlugId = `${fieldIdPrefix}-document-custom-slug`;
  const metaDescriptionId = `${fieldIdPrefix}-document-meta-description`;
  const tagsId = `${fieldIdPrefix}-document-tags`;
  const { activeDoc, updateActiveDocument, setSaving } = useDocs();
  const activeDocIdRef = useRef<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isDirty, setIsDirty] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusResetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isMac, setIsMac] = useState(false);

  // SEO settings states
  const [seoModalOpen, setSeoModalOpen] = useState(false);
  const [customSlug, setCustomSlug] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [modalError, setModalError] = useState('');
  const [modalSaving, setModalSaving] = useState(false);

  // Version History states
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<any | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Image insertion states
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageSource, setImageSource] = useState<'url' | 'upload'>('url');
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [imageError, setImageError] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState('');
  const [imageQuality, setImageQuality] = useState(DEFAULT_IMAGE_QUALITY);
  const [imageMaxEdge, setImageMaxEdge] = useState(DEFAULT_IMAGE_MAX_EDGE);
  const [imageConfig, setImageConfig] = useState<ImageUploadConfig>({
    uploadsEnabled: false,
    maxBytes: 2 * 1024 * 1024,
  });
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const fetchVersions = async () => {
    if (!activeDoc) return;
    setLoadingVersions(true);
    try {
      const res = await fetch(`/api/documents/${activeDoc.id}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
        if (data.versions && data.versions.length > 0) {
          setSelectedVersion(data.versions[0]);
        } else {
          setSelectedVersion(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch versions:', err);
    } finally {
      setLoadingVersions(false);
    }
  };

  useEffect(() => {
    if (historyModalOpen && activeDoc?.id) {
      fetchVersions();
    }
  }, [historyModalOpen, activeDoc?.id]);

  const handleRestoreVersion = async () => {
    if (!activeDoc || !selectedVersion) return;
    setRestoring(true);
    try {
      const res = await fetch(`/api/documents/${activeDoc.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId: selectedVersion.id }),
      });
      if (res.ok) {
        const data = await res.json();
        await updateActiveDocument({
          title: data.document.title,
          content: data.document.content,
          updatedAt: data.document.updatedAt,
        });
        if (editor) {
          editor.commands.setContent(data.document.content || '');
        }
        setRestoreConfirmOpen(false);
        setHistoryModalOpen(false);
      }
    } catch (err) {
      console.error('Failed to restore version:', err);
    } finally {
      setRestoring(false);
    }
  };

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);
  }, []);

  const scheduleStatusReset = () => {
    if (statusResetTimerRef.current) {
      clearTimeout(statusResetTimerRef.current);
    }
    statusResetTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1500);
  };

  useEffect(() => {
    const loadImageConfig = async () => {
      try {
        const res = await fetch('/api/images/config');
        if (res.ok) {
          const data = await res.json();
          setImageConfig({
            uploadsEnabled: !!data.uploadsEnabled,
            maxBytes:
              typeof data.maxBytes === 'number' && data.maxBytes > 0
                ? data.maxBytes
                : 2 * 1024 * 1024,
          });
        }
      } catch (err) {
        console.error('Failed to load image upload configuration:', err);
      }
    };

    loadImageConfig();
  }, []);

  const saveDocument = async (content: string) => {
    if (!activeDoc) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSaveStatus('saving');
    setSaving(true);

    try {
      const res = await fetch(`/api/documents/${activeDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setSaveStatus('saved');
        setIsDirty(false);
        setSaving(false);
        scheduleStatusReset();
      } else {
        setSaveStatus('idle');
        setSaving(false);
      }
    } catch (error) {
      console.error('Failed to save document:', error);
      setSaveStatus('idle');
      setSaving(false);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        allowBase64: false,
        HTMLAttributes: {
          loading: 'lazy',
          decoding: 'async',
        },
      }),
      Markdown.configure({
        html: false,
        linkify: true,
      }),
    ],
    content: activeDoc?.content || '',
    editorProps: {
      attributes: {
        class:
          'prose prose-sm focus:outline-none max-w-none w-full h-full text-text-main bg-bg-card',
      },
    },
    onUpdate: ({ editor }) => {
      const markdown = (editor.storage as any).markdown.getMarkdown();

      // Update local context state (updates sharing title, lists, etc.)
      updateActiveDocument({ content: markdown });

      // Trigger debounced auto-save if enabled
      const isAutoSave = localStorage.getItem('monodoc_autosave') !== 'false';
      if (isAutoSave) {
        triggerAutoSave(markdown);
      } else {
        setIsDirty(true);
        setSaveStatus('idle');
      }
    },
  });

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (editor && activeDoc) {
          const markdown = (editor.storage as any).markdown.getMarkdown();
          await saveDocument(markdown);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor, activeDoc]);

  // Track auto-saving logic
  const triggerAutoSave = (content: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setSaveStatus('idle');

    debounceTimerRef.current = setTimeout(async () => {
      if (!activeDoc) return;

      setSaveStatus('saving');
      setSaving(true);

      try {
        const res = await fetch(`/api/documents/${activeDoc.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        if (res.ok) {
          setSaveStatus('saved');
          setIsDirty(false);
          setSaving(false);
          scheduleStatusReset();
        } else {
          setSaveStatus('idle');
          setSaving(false);
        }
      } catch (error) {
        console.error('Failed to auto-save:', error);
        setSaveStatus('idle');
        setSaving(false);
      }
    }, 1500); // 1.5 seconds debounce as per PRD
  };

  // Sync content only when switching document IDs to avoid cursor jumps
  useEffect(() => {
    if (editor && activeDoc) {
      if (activeDoc.id !== activeDocIdRef.current) {
        activeDocIdRef.current = activeDoc.id;
        editor.commands.setContent(activeDoc.content || '');
        setSaveStatus('idle');
        setIsDirty(false);
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      }
    }
  }, [activeDoc?.id, editor]);

  // Sync SEO metadata states when switching documents
  useEffect(() => {
    if (activeDoc) {
      setCustomSlug(activeDoc.customSlug || '');
      setDescription(activeDoc.description || '');
      setTags(activeDoc.tags || '');
      setModalError('');
    }
  }, [activeDoc?.id]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (statusResetTimerRef.current) {
        clearTimeout(statusResetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (selectedImagePreviewUrl) {
        URL.revokeObjectURL(selectedImagePreviewUrl);
      }
    };
  }, [selectedImagePreviewUrl]);

  const handleSaveSeo = async (e: FormSubmitEvent) => {
    e.preventDefault();
    if (!activeDoc) return;
    setModalError('');
    setModalSaving(true);

    try {
      let cleanSlug = customSlug.trim().toLowerCase();
      if (cleanSlug) {
        if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
          setModalError(
            'Custom slug must only contain lowercase alphanumeric characters and dashes',
          );
          setModalSaving(false);
          return;
        }
        if (
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            cleanSlug,
          )
        ) {
          setModalError('Custom slug cannot be a UUID');
          setModalSaving(false);
          return;
        }
      }

      const res = await fetch(`/api/documents/${activeDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customSlug: cleanSlug || null,
          description: description.trim() || null,
          tags: tags.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update SEO settings');
      }

      await updateActiveDocument({
        customSlug: cleanSlug || null,
        description: description.trim() || null,
        tags: tags.trim() || null,
      });

      setSeoModalOpen(false);
    } catch (err: any) {
      setModalError(err.message || 'An error occurred while saving');
    } finally {
      setModalSaving(false);
    }
  };

  const resetImageModal = () => {
    setImageUrl('');
    setImageAlt('');
    setImageError('');
    setImageUploading(false);
    setSelectedImageFile(null);
    setSelectedImagePreviewUrl('');
    setImageQuality(DEFAULT_IMAGE_QUALITY);
    setImageMaxEdge(DEFAULT_IMAGE_MAX_EDGE);
  };

  const closeImageModal = () => {
    resetImageModal();
    setImageModalOpen(false);
  };

  const normalizeImageUrl = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) throw new Error('Image URL is required');

    const parsed = new URL(trimmed, window.location.origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Only HTTP and HTTPS image URLs are allowed');
    }

    return parsed.href;
  };

  const insertImage = (src: string, alt?: string) => {
    editor
      .chain()
      .focus()
      .setImage({
        src,
        alt: alt?.trim() || undefined,
        title: alt?.trim() || undefined,
      })
      .run();
    closeImageModal();
  };

  const handleInsertImageUrl = (e: FormSubmitEvent) => {
    e.preventDefault();
    setImageError('');

    try {
      insertImage(normalizeImageUrl(imageUrl), imageAlt);
    } catch (err: any) {
      setImageError(err.message || 'Invalid image URL');
    }
  };

  const getUploadFilename = (): string => `${crypto.randomUUID()}.webp`;

  const optimizeImageForUpload = async (file: File): Promise<File> => {
    const maxSizeMB = Math.max(0.1, imageConfig.maxBytes / 1024 / 1024);
    const { default: imageCompression } = await import('browser-image-compression');
    const optimized = await imageCompression(file, {
      maxSizeMB,
      maxWidthOrHeight: imageMaxEdge,
      fileType: 'image/webp',
      initialQuality: imageQuality / 100,
      useWebWorker: false,
    });

    return new File([optimized], getUploadFilename(), {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Only image files can be uploaded');
      }

      setImageError('');
      setSelectedImageFile(file);
      setSelectedImagePreviewUrl(URL.createObjectURL(file));
      if (!imageAlt.trim()) {
        setImageAlt(file.name.replace(/\.[^.]+$/, ''));
      }
    } catch (err: any) {
      setSelectedImageFile(null);
      setSelectedImagePreviewUrl('');
      setImageError(err.message || 'Image selection failed');
    }
  };

  const handleUploadSelectedImage = async () => {
    const documentId = activeDoc?.id;
    if (!documentId) {
      setImageError('Select a document before uploading an image');
      return;
    }
    if (!selectedImageFile) {
      setImageError('Choose an image before uploading');
      return;
    }

    setImageError('');
    setImageUploading(true);

    try {
      const optimized = await optimizeImageForUpload(selectedImageFile);
      if (optimized.size > imageConfig.maxBytes) {
        throw new Error('Optimized image still exceeds the configured upload limit');
      }

      const formData = new FormData();
      formData.append('file', optimized);
      formData.append('documentId', documentId);

      const res = await fetch('/api/images/upload', {
        method: 'POST',
        body: formData,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Image upload failed');
      }
      if (!data.url) {
        throw new Error('Image upload response did not include a URL');
      }

      insertImage(data.url, imageAlt || selectedImageFile.name.replace(/\.[^.]+$/, ''));
    } catch (err: any) {
      setImageError(err.message || 'Image upload failed');
    } finally {
      setImageUploading(false);
    }
  };

  if (!editor || !activeDoc) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-muted/60 bg-bg-app select-none">
        <Sparkles className="w-12 h-12 mb-3 animate-pulse text-text-muted/30" />
        <p className="text-sm font-semibold">Create or select a document to start writing</p>
      </div>
    );
  }

  // Toolbar button helper
  const renderToolbarButton = (
    title: string,
    icon: React.ReactNode,
    onClick: () => void,
    isActive: boolean = false,
    disabled: boolean = false,
  ) => {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        aria-label={title}
        type="button"
        className={`p-1.5 rounded-md transition-all ${
          isActive
            ? 'bg-text-main text-bg-card font-semibold'
            : 'hover:bg-border-custom/30 text-text-muted hover:text-text-main'
        } disabled:opacity-40 disabled:pointer-events-none`}
      >
        {icon}
      </button>
    );
  };

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-bg-app">
      {/* TipTap Formatting Toolbar */}
      <div className="no-print shrink-0 border-b border-border-custom/60 bg-bg-card px-2 py-2 sm:h-11 sm:px-4 sm:py-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {renderToolbarButton(
              'Bold',
              <Bold className="w-4 h-4" />,
              () => editor.chain().focus().toggleBold().run(),
              editor.isActive('bold'),
            )}
            {renderToolbarButton(
              'Italic',
              <Italic className="w-4 h-4" />,
              () => editor.chain().focus().toggleItalic().run(),
              editor.isActive('italic'),
            )}
            {renderToolbarButton(
              'Strikethrough',
              <Strikethrough className="w-4 h-4" />,
              () => editor.chain().focus().toggleStrike().run(),
              editor.isActive('strike'),
            )}
            {renderToolbarButton(
              'Inline Code',
              <Code className="w-4 h-4" />,
              () => editor.chain().focus().toggleCode().run(),
              editor.isActive('code'),
            )}

            <div className="w-px h-5 bg-border-custom/75 mx-1.5" />

            {renderToolbarButton(
              'Heading 1',
              <Heading1 className="w-4 h-4" />,
              () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
              editor.isActive('heading', { level: 1 }),
            )}
            {renderToolbarButton(
              'Heading 2',
              <Heading2 className="w-4 h-4" />,
              () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
              editor.isActive('heading', { level: 2 }),
            )}
            {renderToolbarButton(
              'Heading 3',
              <Heading3 className="w-4 h-4" />,
              () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
              editor.isActive('heading', { level: 3 }),
            )}

            <div className="w-px h-5 bg-border-custom/75 mx-1.5" />

            {renderToolbarButton(
              'Bullet List',
              <List className="w-4 h-4" />,
              () => editor.chain().focus().toggleBulletList().run(),
              editor.isActive('bulletList'),
            )}
            {renderToolbarButton(
              'Ordered List',
              <ListOrdered className="w-4 h-4" />,
              () => editor.chain().focus().toggleOrderedList().run(),
              editor.isActive('orderedList'),
            )}
            {renderToolbarButton(
              'Quote',
              <Quote className="w-4 h-4" />,
              () => editor.chain().focus().toggleBlockquote().run(),
              editor.isActive('blockquote'),
            )}
            {renderToolbarButton(
              'Code Block',
              <Terminal className="w-4 h-4" />,
              () => editor.chain().focus().toggleCodeBlock().run(),
              editor.isActive('codeBlock'),
            )}

            <div className="w-px h-5 bg-border-custom/75 mx-1.5" />

            {renderToolbarButton(
              'Undo',
              <Undo className="w-4 h-4" />,
              () => editor.chain().focus().undo().run(),
              false,
              !editor.can().undo(),
            )}
            {renderToolbarButton(
              'Redo',
              <Redo className="w-4 h-4" />,
              () => editor.chain().focus().redo().run(),
              false,
              !editor.can().redo(),
            )}

            <div className="w-px h-5 bg-border-custom/75 mx-1.5" />

            {renderToolbarButton('Document SEO Settings', <Settings className="w-4 h-4" />, () =>
              setSeoModalOpen(true),
            )}

            {renderToolbarButton('Document Version History', <History className="w-4 h-4" />, () =>
              setHistoryModalOpen(true),
            )}

            {renderToolbarButton('Add Image', <ImageIcon className="w-4 h-4" />, () => {
              setImageSource(imageConfig.uploadsEnabled ? 'upload' : 'url');
              setImageModalOpen(true);
            })}

            {renderToolbarButton(
              `Save Document (${isMac ? '⌘+S' : 'Ctrl+S'})`,
              <Save className="w-4 h-4" />,
              () => {
                const markdown = (editor.storage as any).markdown.getMarkdown();
                saveDocument(markdown);
              },
              false,
              saveStatus === 'saving',
            )}
          </div>

          {/* Debounced status overlay */}
          <div className="min-h-4 pr-1 text-3xs text-text-muted italic select-none sm:text-right">
            <div className="flex items-center gap-1.5 sm:justify-end">
              {saveStatus === 'saving' && 'Saving draft...'}
              {saveStatus === 'saved' && 'Draft saved'}
              {saveStatus === 'idle' && isDirty && (
                <span className="flex items-center gap-1 font-semibold text-amber-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Unsaved changes
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Word-like Paper Workspace */}
      <div className="print-container flex flex-1 justify-center overflow-y-auto p-2 sm:p-4 md:p-8">
        <div className="word-paper print-container w-full max-w-4xl rounded-none px-4 py-6 sm:rounded-lg sm:px-6 sm:py-8 md:px-16 md:py-12">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Image Modal */}
      {imageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm no-print p-4">
          <div className="flex w-[calc(100vw-1rem)] max-w-5xl max-h-[calc(100vh-1rem)] flex-col overflow-hidden bg-bg-card border border-border-custom rounded-xl p-5 shadow-2xl relative text-text-main animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={closeImageModal}
              className="absolute top-4 right-4 p-1 rounded hover:bg-border-custom/30 text-text-muted hover:text-text-main transition-colors cursor-pointer"
              aria-label="Close"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-black tracking-tight mb-3 flex items-center gap-1.5 select-none">
              <ImageIcon className="w-5 h-5 text-text-muted" />
              Add Image
            </h2>

            {imageConfig.uploadsEnabled && (
              <div className="grid grid-cols-2 gap-2 mb-3 select-none">
                <button
                  type="button"
                  onClick={() => {
                    setImageSource('upload');
                    setImageError('');
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    imageSource === 'upload'
                      ? 'bg-text-main text-bg-card border-text-main'
                      : 'bg-bg-app text-text-muted border-border-custom hover:text-text-main'
                  }`}
                >
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImageSource('url');
                    setImageError('');
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    imageSource === 'url'
                      ? 'bg-text-main text-bg-card border-text-main'
                      : 'bg-bg-app text-text-muted border-border-custom hover:text-text-main'
                  }`}
                >
                  URL
                </button>
              </div>
            )}

            {imageError && (
              <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                <span>{imageError}</span>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
              {imageSource === 'upload' && imageConfig.uploadsEnabled ? (
                <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_20rem]">
                  <input
                    id={imageUploadFileId}
                    name="documentImageUploadFile"
                    ref={imageFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />

                  <div className="min-w-0 space-y-3">
                    {selectedImagePreviewUrl ? (
                      <>
                        <button
                          type="button"
                          onClick={() => imageFileInputRef.current?.click()}
                          disabled={imageUploading}
                          className="group relative flex h-56 sm:h-72 md:h-88 w-full items-center justify-center overflow-hidden rounded-xl border border-border-custom bg-bg-app shadow-sm cursor-pointer disabled:opacity-50 disabled:pointer-events-none transition-all hover:border-text-main/30"
                        >
                          {/* Checkerboard pattern for transparent images context */}
                          <div
                            className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
                            style={{
                              backgroundImage:
                                'linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%)',
                              backgroundSize: '16px 16px',
                              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                            }}
                          />
                          <img
                            src={selectedImagePreviewUrl}
                            alt={imageAlt || 'Selected image preview'}
                            className="relative z-10 h-full w-full object-contain p-2 drop-shadow-sm"
                          />
                          <div className="absolute inset-x-0 bottom-0 top-1/2 bg-linear-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100 z-20" />
                          <span className="absolute bottom-3 right-3 z-30 rounded-lg border border-white/20 bg-black/70 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-white shadow-lg transition-transform scale-95 group-hover:scale-100 opacity-0 group-hover:opacity-100">
                            Change Image
                          </span>
                        </button>
                        <div className="flex items-center justify-between gap-2 text-3xs font-semibold text-text-muted px-1">
                          <span className="min-w-0 truncate" title={selectedImageFile?.name}>
                            {selectedImageFile?.name}
                          </span>
                          <span className="shrink-0 font-mono bg-bg-app px-1.5 py-0.5 rounded border border-border-custom text-[10px]">
                            {selectedImageFile ? formatBytes(selectedImageFile.size) : ''}
                          </span>
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => imageFileInputRef.current?.click()}
                        disabled={imageUploading}
                        className="group flex h-56 sm:h-72 md:h-88 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border-custom bg-bg-app/50 px-4 py-3 text-text-main text-sm font-bold transition-all hover:bg-border-custom/20 hover:border-text-main/40 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                      >
                        <div className="rounded-full bg-border-custom/30 p-4 transition-transform group-hover:scale-110 group-hover:bg-text-main/10 group-hover:text-text-main">
                          <Upload className="w-6 h-6 text-text-muted transition-colors group-hover:text-text-main" />
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span>Click to browse</span>
                          <span className="text-3xs font-medium text-text-muted">
                            Supports JPG, PNG, WebP, GIF
                          </span>
                        </div>
                      </button>
                    )}
                  </div>

                  <div className="min-w-0 flex flex-col space-y-4">
                    <div>
                      <label
                        htmlFor={imageUploadAltId}
                        className="block text-3xs font-bold uppercase tracking-widest mb-1 text-text-muted select-none"
                      >
                        Alt Text
                      </label>
                      <input
                        id={imageUploadAltId}
                        name="documentImageUploadAlt"
                        type="text"
                        value={imageAlt}
                        onChange={(e) => setImageAlt(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border-custom bg-bg-app text-text-main outline-none focus:ring-1 focus:ring-text-main focus:border-text-main transition-all font-semibold"
                        placeholder="Short image description"
                      />
                    </div>

                    {selectedImageFile && (
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between gap-3 mb-2 text-3xs font-bold uppercase tracking-widest text-text-muted select-none">
                            <label htmlFor={imageQualityId}>Quality</label>
                            <span>{imageQuality}%</span>
                          </div>
                          <input
                            id={imageQualityId}
                            type="range"
                            min="35"
                            max="100"
                            step="1"
                            value={imageQuality}
                            onChange={(e) => setImageQuality(Number(e.target.value))}
                            disabled={imageUploading}
                            className="w-full accent-text-main disabled:opacity-50"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between gap-3 mb-2 text-3xs font-bold uppercase tracking-widest text-text-muted select-none">
                            <label htmlFor={imageMaxEdgeId}>Max Edge</label>
                            <span>{imageMaxEdge}px</span>
                          </div>
                          <input
                            id={imageMaxEdgeId}
                            type="range"
                            min={MIN_IMAGE_EDGE}
                            max={MAX_IMAGE_EDGE}
                            step={IMAGE_EDGE_STEP}
                            value={imageMaxEdge}
                            onChange={(e) => setImageMaxEdge(Number(e.target.value))}
                            disabled={imageUploading}
                            className="w-full accent-text-main disabled:opacity-50"
                          />
                        </div>

                        <div className="text-3xs text-text-muted font-semibold">
                          Upload limit: {formatBytes(imageConfig.maxBytes)}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end mt-auto pt-2">
                      <button
                        type="button"
                        onClick={closeImageModal}
                        disabled={imageUploading}
                        className="flex-1 sm:flex-none px-4 py-2.5 text-xs rounded-lg border border-border-custom bg-bg-app text-text-main hover:bg-border-custom/40 font-bold transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleUploadSelectedImage}
                        disabled={!selectedImageFile || imageUploading}
                        className="flex-1 sm:flex-none px-4 py-2.5 text-xs rounded-lg bg-text-main text-bg-card font-bold hover:opacity-90 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                      >
                        {imageUploading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-bg-card/60 border-t-transparent rounded-full animate-spin" />
                            Optimizing...
                          </>
                        ) : (
                          'Upload Image'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleInsertImageUrl} className="space-y-4">
                  <div>
                    <label
                      htmlFor={imageUrlAltId}
                      className="block text-3xs font-bold uppercase tracking-widest mb-1 text-text-muted select-none"
                    >
                      Alt Text
                    </label>
                    <input
                      id={imageUrlAltId}
                      name="documentImageUrlAlt"
                      type="text"
                      value={imageAlt}
                      onChange={(e) => setImageAlt(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-border-custom bg-bg-app text-text-main outline-none focus:ring-1 focus:ring-text-main focus:border-text-main transition-all font-semibold"
                      placeholder="Short image description"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={imageUrlId}
                      className="block text-3xs font-bold uppercase tracking-widest mb-1 text-text-muted select-none"
                    >
                      Image URL
                    </label>
                    <input
                      id={imageUrlId}
                      name="documentImageUrl"
                      type="url"
                      required
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-border-custom bg-bg-app text-text-main outline-none focus:ring-1 focus:ring-text-main focus:border-text-main transition-all font-mono"
                      placeholder="https://example.com/image.webp"
                    />
                  </div>

                  <div className="flex gap-2 pt-2 justify-end">
                    <button
                      type="button"
                      onClick={closeImageModal}
                      className="px-4 py-2 text-xs rounded-lg border border-border-custom bg-bg-app text-text-main hover:bg-border-custom/25 font-bold transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs rounded-lg bg-text-main text-bg-card font-bold hover:opacity-90 transition-all cursor-pointer"
                    >
                      Insert Image
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SEO Settings Modal */}
      {seoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm no-print p-4">
          <div className="bg-bg-card border border-border-custom rounded-xl p-6 w-full max-w-md shadow-2xl relative text-text-main animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setSeoModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded hover:bg-border-custom/30 text-text-muted hover:text-text-main transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-black tracking-tight mb-2 flex items-center gap-1.5 select-none">
              <Settings className="w-5 h-5 text-text-muted" />
              Document SEO Settings
            </h2>
            <p className="text-3xs text-text-muted mb-4 select-none">
              Configure search engine optimization details and custom URLs for this document.
            </p>

            {modalError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSeo} className="space-y-4">
              <div>
                <label
                  htmlFor={customSlugId}
                  className="block text-3xs font-bold uppercase tracking-widest mb-1 text-text-muted select-none"
                >
                  Custom Slug
                </label>
                <input
                  id={customSlugId}
                  name="documentCustomSlug"
                  type="text"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border-custom bg-bg-app text-text-main outline-none focus:ring-1 focus:ring-text-main focus:border-text-main transition-all font-mono"
                  placeholder="e.g. my-first-note"
                />
                <span className="text-[10px] text-text-muted/70 mt-1 block select-none leading-relaxed">
                  Only lowercase letters, numbers, and dashes. Leave blank to use the document's
                  default ID.
                </span>
              </div>

              <div>
                <label
                  htmlFor={metaDescriptionId}
                  className="block text-3xs font-bold uppercase tracking-widest mb-1 text-text-muted select-none"
                >
                  Meta Description
                </label>
                <textarea
                  id={metaDescriptionId}
                  name="documentMetaDescription"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={160}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border-custom bg-bg-app text-text-main outline-none focus:ring-1 focus:ring-text-main focus:border-text-main transition-all font-semibold"
                  placeholder="Enter a brief summary for search engines (max 160 chars)..."
                />
                <div className="flex justify-between text-[10px] text-text-muted/70 mt-0.5 select-none">
                  <span>Describe the content briefly.</span>
                  <span>{description.length}/160</span>
                </div>
              </div>

              <div>
                <label
                  htmlFor={tagsId}
                  className="block text-3xs font-bold uppercase tracking-widest mb-1 text-text-muted select-none"
                >
                  Tags / Keywords
                </label>
                <input
                  id={tagsId}
                  name="documentTags"
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border-custom bg-bg-app text-text-main outline-none focus:ring-1 focus:ring-text-main focus:border-text-main transition-all font-semibold"
                  placeholder="e.g. react, tutorial, coding"
                />
                <span className="text-[10px] text-text-muted/70 mt-1 block select-none">
                  Comma-separated keywords to help catalog and index this article.
                </span>
              </div>

              <div className="flex gap-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setSeoModalOpen(false)}
                  className="px-4 py-2 text-xs rounded-lg border border-border-custom bg-bg-app text-text-main hover:bg-border-custom/25 font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSaving}
                  className="px-4 py-2 text-xs rounded-lg bg-text-main text-bg-card font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {modalSaving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md no-print p-4">
          <div className="bg-bg-card border border-border-custom rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl relative text-text-main animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-border-custom/60 flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-text-main/10 rounded-lg text-text-main">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight flex items-center gap-1.5">
                    Document Version History
                  </h2>
                  <p className="text-3xs text-text-muted mt-0.5">
                    Versions are automatically recorded every 5 minutes and retained for up to 7
                    days.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-border-custom/30 text-text-muted hover:text-text-main transition-all cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* Left Column: Version List */}
              <div className="w-1/3 border-r border-border-custom/60 flex flex-col min-w-70">
                <div className="p-4 bg-bg-app/50 border-b border-border-custom/40 shrink-0 select-none">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    Available Versions ({versions.length})
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {loadingVersions ? (
                    <div className="h-full flex items-center justify-center text-xs text-text-muted font-semibold">
                      <div className="w-5 h-5 border-2 border-text-muted border-t-transparent rounded-full animate-spin mr-2" />
                      Loading history...
                    </div>
                  ) : versions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none text-text-muted/70">
                      <History className="w-8 h-8 mb-2 opacity-30" />
                      <p className="text-xs font-bold">No versions saved yet</p>
                      <p className="text-[10px] mt-1 leading-relaxed">
                        Start editing your document. We'll automatically back up a state when you
                        edit.
                      </p>
                    </div>
                  ) : (
                    versions.map((v) => {
                      const isSelected = selectedVersion?.id === v.id;
                      const formattedDate = new Date(v.createdAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      });
                      return (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVersion(v)}
                          className={`w-full text-left p-3.5 rounded-xl transition-all cursor-pointer flex flex-col gap-1 ${
                            isSelected
                              ? 'bg-text-main text-bg-card shadow-md shadow-text-main/10 scale-[0.99]'
                              : 'hover:bg-border-custom/20 bg-bg-card border border-border-custom/40 text-text-main'
                          }`}
                        >
                          <span className="text-xs font-black truncate">
                            {v.title || 'Untitled Document'}
                          </span>
                          <span
                            className={`text-[10px] font-semibold ${isSelected ? 'text-bg-card/80' : 'text-text-muted'}`}
                          >
                            {formattedDate}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Version Preview */}
              <div className="flex-1 flex flex-col bg-bg-app/20 overflow-hidden">
                {selectedVersion ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b border-border-custom/60 flex items-center justify-between bg-bg-card shrink-0 select-none">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                          Version Preview
                        </span>
                        <span className="text-xs font-extrabold truncate text-text-main">
                          {selectedVersion.title}
                        </span>
                      </div>
                      <button
                        onClick={() => setRestoreConfirmOpen(true)}
                        className="px-4 py-2 text-xs rounded-xl bg-text-main text-bg-card font-extrabold hover:opacity-90 transition-all flex items-center gap-1.5 shadow-md shadow-text-main/10 cursor-pointer"
                      >
                        Restore Version
                      </button>
                    </div>

                    {/* Content Preview Container */}
                    <div className="flex-1 p-6 overflow-y-auto font-mono text-xs text-text-main bg-bg-card/40 whitespace-pre-wrap leading-relaxed">
                      {selectedVersion.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-text-muted/60 select-none">
                    <History className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-xs font-bold">Select a version to preview</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Dialog */}
      {restoreConfirmOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md no-print p-4">
          <div className="bg-bg-card border border-border-custom rounded-2xl p-6 w-full max-w-md shadow-2xl relative text-text-main animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-black tracking-tight mb-2 text-red-500 flex items-center gap-2 select-none">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              Confirm Version Restore
            </h3>
            <p className="text-xs text-text-muted mb-4 leading-relaxed">
              Are you sure you want to restore the selected version? This will **overwrite your
              current document's title and content**.
            </p>
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-6 text-red-500 text-xs font-medium leading-relaxed">
              <strong>Caution (Override Rule):</strong> All saved versions that are{' '}
              <strong>newer</strong> than the restored version will be permanently deleted from
              history.
            </div>

            <div className="flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setRestoreConfirmOpen(false)}
                className="px-4 py-2 text-xs rounded-xl border border-border-custom bg-bg-app text-text-main hover:bg-border-custom/25 font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreVersion}
                disabled={restoring}
                className="px-4 py-2 text-xs rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {restoring ? 'Restoring...' : 'Yes, Restore & Overwrite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
