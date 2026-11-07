import React, { useState, useRef } from 'react';
import {
  StudyProject,
  StylePreset,
  McCloudTransition,
  CinemaShotType,
} from '../types/analyzer';
import {
  MCCLOUD_TRANSITION_META,
  CINEMA_SHOT_META,
} from '../data/curatedStudies';
import {
  X,
  Upload,
  Check,
  CloudUpload,
  Trash2,
  Film,
  BookOpen,
  Sparkles,
  LogIn,
} from 'lucide-react';

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  curatedStudies: StudyProject[];
  cloudProjects: StudyProject[];
  activeProjectId: string;
  currentUserUid: string | null;
  onSelectStudy: (study: StudyProject) => void;
  onUploadCustomImage: (
    dataUrl: string,
    title: string,
    medium: 'cinema' | 'comic',
    aspectRatio: string
  ) => void;
  onDeleteCloudProject: (id: string) => void;
}

export const ArchiveModal: React.FC<ArchiveModalProps> = ({
  isOpen,
  onClose,
  curatedStudies,
  cloudProjects,
  activeProjectId,
  currentUserUid,
  onSelectStudy,
  onUploadCustomImage,
  onDeleteCloudProject,
}) => {
  const [filterMedium, setFilterMedium] = useState<'all' | 'comic' | 'cinema'>(
    'all'
  );
  const [uploadMedium, setUploadMedium] = useState<'comic' | 'cinema'>('comic');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Compress uploaded image onto an offscreen canvas so it stays well within Firestore's 1MB limit
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1100;
        let w = img.naturalWidth || 1000;
        let h = img.naturalHeight || 750;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        const cleanTitle =
          uploadTitle.trim() ||
          file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
        const ratio =
          w > h * 1.2
            ? `${(w / h).toFixed(2)}:1 Widescreen`
            : `${w}:${h} Vertical Plate`;

        onUploadCustomImage(compressedDataUrl, cleanTitle, uploadMedium, ratio);
        onClose();
      };
      img.onerror = () => {
        setUploadError('Unable to decode the selected image file.');
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const filteredCurated = curatedStudies.filter(
    (s) => filterMedium === 'all' || s.medium === filterMedium
  );
  const filteredCloud = cloudProjects.filter(
    (s) => filterMedium === 'all' || s.medium === filterMedium
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[#FBF9F5] border border-[#D6CEBE] rounded-md max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D6CEBE] bg-[#EBE6DF]">
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#1C1917]">
              Curated Study Archive &amp; Custom Plate Upload
            </h2>
            <p className="text-xs text-[#57534E] mt-0.5">
              Select a pre-annotated cinema still or sequential comic page, load a
              saved cloud breakdown, or upload your own artwork.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#57534E] hover:text-[#1C1917]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Custom Upload Banner */}
          <div className="p-5 bg-[#EBE6DF] border border-[#D6CEBE] rounded space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-serif text-base font-semibold text-[#1C1917]">
                  Upload Custom Film Still or Comic Page
                </h3>
                <p className="text-xs text-[#57534E] mt-0.5">
                  Supports JPG, PNG, and WebP. Automatically optimized for 60fps
                  WebGL shader evaluation and cloud storage.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#9A3412] text-[#FBF9F5] hover:bg-[#7C2D12] rounded transition-colors whitespace-nowrap shrink-0"
              >
                <Upload className="w-4 h-4" />
                <span>Choose Image File...</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#D6CEBE]">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Optional Study Title
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g., Blade Runner 2049 — Corridor Frame or Watchmen Ch. IV Page 12"
                  className="w-full px-3 py-1.5 text-xs bg-[#FBF9F5] border border-[#D6CEBE] rounded text-[#1C1917]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Medium Preset
                </label>
                <select
                  value={uploadMedium}
                  onChange={(e) =>
                    setUploadMedium(e.target.value as 'comic' | 'cinema')
                  }
                  className="w-full px-3 py-1.5 text-xs bg-[#FBF9F5] border border-[#D6CEBE] rounded text-[#1C1917]"
                >
                  <option value="comic">Sequential Comic Page</option>
                  <option value="cinema">Cinema Still Frame</option>
                </select>
              </div>
            </div>
            {uploadError && (
              <p className="text-xs text-[#9A3412] font-medium">{uploadError}</p>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center justify-between border-b border-[#D6CEBE] pb-3">
            <h3 className="font-serif text-base font-semibold text-[#1C1917]">
              Built-In Curatorial Plates ({filteredCurated.length})
            </h3>
            <div className="flex items-center gap-1 p-1 bg-[#EBE6DF] rounded border border-[#D6CEBE]">
              {(['all', 'comic', 'cinema'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setFilterMedium(m)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors capitalize ${
                    filterMedium === m
                      ? 'bg-[#FBF9F5] text-[#1C1917] shadow-2xs'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {m === 'all' ? 'All Plates' : m}
                </button>
              ))}
            </div>
          </div>

          {/* Curated Plates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCurated.map((study) => {
              const isCurrent = study.id === activeProjectId;
              return (
                <div
                  key={study.id}
                  onClick={() => {
                    onSelectStudy(study);
                    onClose();
                  }}
                  className={`group flex flex-col border rounded overflow-hidden cursor-pointer transition-colors ${
                    isCurrent
                      ? 'border-[#9A3412] bg-[#EBE6DF]/60'
                      : 'border-[#D6CEBE] bg-[#FBF9F5] hover:border-[#1C1917]'
                  }`}
                >
                  <div className="relative h-44 bg-[#1C1917] overflow-hidden">
                    <img
                      src={study.imageUrl}
                      alt={study.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover opacity-95 group-hover:scale-102 transition-transform duration-200"
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#57534E]">
                        <span>{study.accessionNumber}</span>
                        <span aria-hidden="true">·</span>
                        <span className="uppercase">{study.medium}</span>
                        <span aria-hidden="true">·</span>
                        <span>{study.annotations.length} regions</span>
                      </div>
                      <h4 className="font-serif text-base font-semibold text-[#1C1917] mt-1">
                        {study.title}
                      </h4>
                      <p className="text-xs text-[#57534E] mt-0.5">
                        {study.creatorCredit}
                      </p>
                    </div>
                    <p className="text-xs text-[#57534E] line-clamp-2 leading-relaxed">
                      {study.curatorNotes}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Saved Cloud Studies Section */}
          <div className="space-y-3 border-t border-[#D6CEBE] pt-6">
            <h3 className="font-serif text-base font-semibold text-[#1C1917]">
              Community &amp; Personal Cloud Studies ({filteredCloud.length})
            </h3>
            {filteredCloud.length === 0 ? (
              <p className="text-xs text-[#57534E] italic">
                No cloud studies saved yet. Use the &ldquo;Save Study&rdquo;
                button in the top bar to persist your breakdowns to Firebase.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCloud.map((study) => (
                  <div
                    key={study.id}
                    onClick={() => {
                      onSelectStudy(study);
                      onClose();
                    }}
                    className="flex items-center justify-between gap-3 p-3.5 border border-[#D6CEBE] bg-[#FBF9F5] hover:border-[#1C1917] rounded cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={study.imageUrl}
                        alt={study.title}
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 object-cover rounded-xs border border-[#D6CEBE] shrink-0 bg-[#1C1917]"
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] font-mono text-[#57534E]">
                          {study.accessionNumber} · {study.medium.toUpperCase()} ·{' '}
                          {study.annotations.length} boxes
                        </div>
                        <div className="font-serif text-sm font-semibold text-[#1C1917] truncate">
                          {study.title}
                        </div>
                        <div className="text-xs text-[#57534E] truncate">
                          Curated by {study.ownerName || 'Archivist'}
                        </div>
                      </div>
                    </div>

                    {currentUserUid && study.ownerId === currentUserUid && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCloudProject(study.id);
                        }}
                        className="p-1.5 text-[#57534E] hover:text-[#9A3412] shrink-0"
                        title="Delete Cloud Study"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface PresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  builtInPresets: StylePreset[];
  cloudPresets: StylePreset[];
  currentUserUid: string | null;
  onApplyPreset: (preset: StylePreset) => void;
  onSaveNewPreset: (
    name: string,
    description: string,
    category: 'cinema' | 'comic' | 'universal',
    isPublic: boolean
  ) => Promise<void>;
  onDeletePreset: (id: string) => Promise<void>;
  onRequestSignIn: () => Promise<void>;
}

export const PresetsModal: React.FC<PresetsModalProps> = ({
  isOpen,
  onClose,
  builtInPresets,
  cloudPresets,
  currentUserUid,
  onApplyPreset,
  onSaveNewPreset,
  onDeletePreset,
  onRequestSignIn,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'cinema' | 'comic' | 'universal'>(
    'universal'
  );
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;
    setSaving(true);
    try {
      await onSaveNewPreset(name.trim(), description.trim(), category, isPublic);
      setName('');
      setDescription('');
    } finally {
      setSaving(false);
    }
  };

  const allPresets = [...builtInPresets, ...cloudPresets];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[#FBF9F5] border border-[#D6CEBE] rounded-md max-w-3xl w-full max-h-[86vh] flex flex-col overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D6CEBE] bg-[#EBE6DF]">
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#1C1917]">
              Optical &amp; Geometric Style Presets
            </h2>
            <p className="text-xs text-[#57534E] mt-0.5">
              Apply calibrated combinations of WebGL shaders and geometric guides
              or publish your current setup to Firebase.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#57534E] hover:text-[#1C1917]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Preset Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {allPresets.map((preset) => (
              <div
                key={preset.id}
                className="p-4 border border-[#D6CEBE] bg-[#FBF9F5] hover:border-[#1C1917] rounded flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#57534E]">
                    <span>
                      {preset.category.toUpperCase()} · SHADER:{' '}
                      {preset.shaderConfig.mode.toUpperCase()}
                    </span>
                    <span>{preset.authorName || 'Community'}</span>
                  </div>
                  <h3 className="font-serif text-base font-semibold text-[#1C1917]">
                    {preset.name}
                  </h3>
                  <p className="text-xs text-[#57534E] leading-relaxed">
                    {preset.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#EBE6DF]">
                  <button
                    type="button"
                    onClick={() => {
                      onApplyPreset(preset);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1C1917] text-[#FBF9F5] hover:bg-[#9A3412] rounded transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply Preset</span>
                  </button>

                  {!preset.isBuiltIn &&
                    currentUserUid &&
                    preset.authorId === currentUserUid && (
                      <button
                        type="button"
                        onClick={() => onDeletePreset(preset.id)}
                        className="p-1.5 text-[#57534E] hover:text-[#9A3412]"
                        title="Delete Preset"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>

          {/* Save Current Active Shader + Guides as Cloud Style Preset */}
          <div className="p-5 bg-[#EBE6DF] border border-[#D6CEBE] rounded space-y-3">
            <h3 className="font-serif text-base font-semibold text-[#1C1917]">
              Save Current Shader &amp; Armature Setup as Preset
            </h3>
            {!currentUserUid ? (
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-[#57534E]">
                  Sign in with Google to save and share custom style presets in
                  Firestore.
                </p>
                <button
                  type="button"
                  onClick={onRequestSignIn}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#9A3412] text-[#FBF9F5] rounded whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In with Google</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[#57534E] mb-1">
                      Preset Name
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={80}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Chiaroscuro High-Key Edge Check"
                      className="w-full px-3 py-1.5 text-xs bg-[#FBF9F5] border border-[#D6CEBE] rounded text-[#1C1917]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#57534E] mb-1">
                      Target Medium
                    </label>
                    <select
                      value={category}
                      onChange={(e) =>
                        setCategory(
                          e.target.value as 'cinema' | 'comic' | 'universal'
                        )
                      }
                      className="w-full px-3 py-1.5 text-xs bg-[#FBF9F5] border border-[#D6CEBE] rounded text-[#1C1917]"
                    >
                      <option value="universal">Universal</option>
                      <option value="comic">Sequential Comic</option>
                      <option value="cinema">Cinema Frame</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#57534E] mb-1">
                    Analytical Purpose
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={280}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what this combination of shader parameters and grids reveals..."
                    className="w-full px-3 py-1.5 text-xs bg-[#FBF9F5] border border-[#D6CEBE] rounded text-[#1C1917]"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs text-[#1C1917] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      className="accent-[#9A3412]"
                    />
                    <span>Share in Public Community Preset Gallery</span>
                  </label>

                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#9A3412] text-[#FBF9F5] hover:bg-[#7C2D12] rounded disabled:opacity-50"
                  >
                    <CloudUpload className="w-3.5 h-3.5" />
                    <span>{saving ? 'Publishing...' : 'Publish Preset'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface TaxonomyGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TaxonomyGuideModal: React.FC<TaxonomyGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[#FBF9F5] border border-[#D6CEBE] rounded-md max-w-4xl w-full max-h-[86vh] flex flex-col overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D6CEBE] bg-[#EBE6DF]">
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#1C1917]">
              Narrative &amp; Optical Taxonomy Reference
            </h2>
            <p className="text-xs text-[#57534E] mt-0.5">
              Field monograph on Scott McCloud’s 6 Panel-to-Panel Transitions and
              Classical Cinema Shot Framing.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#57534E] hover:text-[#1C1917]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Scott McCloud Transitions */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#D6CEBE] pb-2">
              <BookOpen className="w-4 h-4 text-[#9A3412]" />
              <h3 className="font-serif text-lg font-semibold text-[#1C1917]">
                Scott McCloud’s Panel-to-Panel Gutter Transitions
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {(Object.keys(MCCLOUD_TRANSITION_META) as McCloudTransition[])
                .filter((k) => k !== 'establishing-open')
                .map((key) => {
                  const meta = MCCLOUD_TRANSITION_META[key];
                  return (
                    <div
                      key={key}
                      className="p-4 bg-[#EBE6DF]/50 border border-[#D6CEBE] rounded space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-serif text-sm font-semibold text-[#1C1917]">
                          {meta.name}
                        </span>
                        <span
                          className="font-mono text-xs font-semibold px-2 py-0.5 text-[#FBF9F5] rounded-xs"
                          style={{ backgroundColor: meta.badgeColor }}
                        >
                          {meta.code}
                        </span>
                      </div>
                      <p className="text-xs text-[#1C1917] leading-relaxed">
                        {meta.shortDesc}
                      </p>
                      <p className="text-[11px] text-[#57534E] italic">
                        {meta.editorialNote}
                      </p>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Cinema Shot Scales */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#D6CEBE] pb-2">
              <Film className="w-4 h-4 text-[#1E3A8A]" />
              <h3 className="font-serif text-lg font-semibold text-[#1C1917]">
                Cinematography Shot Scales &amp; Camera Axes
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {(Object.keys(CINEMA_SHOT_META) as CinemaShotType[]).map((key) => {
                const shot = CINEMA_SHOT_META[key];
                return (
                  <div
                    key={key}
                    className="p-3 bg-[#FBF9F5] border border-[#D6CEBE] rounded space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#1C1917]">
                        {shot.name}
                      </span>
                      <span className="font-mono text-[11px] text-[#9A3412] font-semibold">
                        {shot.code}
                      </span>
                    </div>
                    <p className="text-xs text-[#57534E] leading-relaxed">
                      {shot.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
