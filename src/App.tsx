/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  signInWithGoogle,
  signOutUser,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  StudyProject,
  StylePreset,
  ShaderConfig,
  GuidesConfig,
  PanelAnnotation,
  VanishingPoint,
  StageToolMode,
  LuminanceMetrics,
} from './types/analyzer';
import { CURATED_STUDIES, BUILT_IN_PRESETS } from './data/curatedStudies';
import { WebGLStage } from './components/WebGLStage';
import { InspectorDeck } from './components/InspectorDeck';
import {
  ArchiveModal,
  PresetsModal,
  TaxonomyGuideModal,
} from './components/Modals';
import {
  Upload,
  CloudUpload,
  CheckCircle2,
  AlertCircle,
  LogOut,
} from 'lucide-react';

export default function App() {
  // Active study project state
  const [project, setProject] = useState<StudyProject>(() =>
     structuredClone(CURATED_STUDIES[0])
  );
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<
    string | null
  >(CURATED_STUDIES[0].annotations[0]?.id || null);
  const [toolMode, setToolMode] = useState<StageToolMode>('select');
  const [metrics, setMetrics] = useState<LuminanceMetrics>({
    meanLuminance: 48,
    shadowRatio: 34,
    midtoneRatio: 46,
    highlightRatio: 20,
    contrastIndex: 28,
    histogram: [18, 32, 45, 52, 48, 40, 38, 42, 50, 58, 64, 54, 42, 36, 28, 22],
  });

  // Modals state
  const [activeModal, setActiveModal] = useState<
    'archive' | 'presets' | 'guide' | null
  >(null);

  // Firebase Auth & Cloud state
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudProjects, setCloudProjects] = useState<StudyProject[]>([]);
  const [cloudPresets, setCloudPresets] = useState<StylePreset[]>([]);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isSavingCloud, setIsSavingCloud] = useState(false);

  const quickUploadInputRef = useRef<HTMLInputElement | null>(null);
  const exportTriggerRef = useRef<(() => void) | null>(null);

  const showToast = useCallback(
    (type: 'success' | 'error', message: string) => {
      setStatusBanner({ type, message });
      setTimeout(() => {
        setStatusBanner((prev) => (prev?.message === message ? null : prev));
      }, 4000);
    },
    []
  );

  // Track Firebase Authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currUser) => {
      setUser(currUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to public & personal projects and stylePresets in Firestore
  useEffect(() => {
    if (!authReady) return;

    const publicProjectsQuery = query(
      collection(db, 'projects'),
      where('isPublic', '==', true)
    );
    const unsubPublicProjects = onSnapshot(
      publicProjectsQuery,
      (snapshot) => {
        const items: StudyProject[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: String(data.title || 'Untitled Study'),
            medium: data.medium === 'cinema' ? 'cinema' : 'comic',
            creatorCredit: String(data.creatorCredit || 'Archivist'),
            year: String(data.year || '2026'),
            aspectRatio: String(data.aspectRatio || '16:9'),
            accessionNumber: String(data.accessionNumber || 'ACC. CLOUD'),
            imageUrl: String(data.imageUrl || CURATED_STUDIES[0].imageUrl),
            curatorNotes: String(data.curatorNotes || ''),
            shaderConfig: (data.shaderConfig as ShaderConfig) ||
              CURATED_STUDIES[0].shaderConfig,
            guidesConfig: (data.guidesConfig as GuidesConfig) ||
              CURATED_STUDIES[0].guidesConfig,
            annotations: Array.isArray(data.annotations)
              ? (data.annotations as PanelAnnotation[])
              : [],
            ownerId: String(data.ownerId || ''),
            ownerName: String(data.ownerName || 'Archivist'),
            isPublic: Boolean(data.isPublic),
          };
        });
        setCloudProjects(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'projects');
      }
    );

    const publicPresetsQuery = query(
      collection(db, 'stylePresets'),
      where('isPublic', '==', true)
    );
    const unsubPublicPresets = onSnapshot(
      publicPresetsQuery,
      (snapshot) => {
        const items: StylePreset[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name || 'Custom Preset'),
            description: String(data.description || ''),
            category:
              data.category === 'cinema' || data.category === 'comic'
                ? data.category
                : 'universal',
            shaderConfig: (data.shaderConfig as ShaderConfig) ||
              BUILT_IN_PRESETS[0].shaderConfig,
            guidesConfig: (data.guidesConfig as GuidesConfig) ||
              BUILT_IN_PRESETS[0].guidesConfig,
            authorId: String(data.authorId || ''),
            authorName: String(data.authorName || 'Archivist'),
            isPublic: Boolean(data.isPublic),
          };
        });
        setCloudPresets(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'stylePresets');
      }
    );

    return () => {
      unsubPublicProjects();
      unsubPublicPresets();
    };
  }, [authReady]);

  // Handlers for updating active project state
  const handleSelectStudy = (study: StudyProject) => {
    const cloned = structuredClone(study);
    setProject(cloned);
    setSelectedAnnotationId(cloned.annotations[0]?.id || null);
    setToolMode('select');
  };

  const handleUpdateProjectMeta = (patch: Partial<StudyProject>) => {
    setProject((prev) => ({ ...prev, ...patch }));
  };

  const handleUpdateShader = (patch: Partial<ShaderConfig>) => {
    setProject((prev) => ({
      ...prev,
      shaderConfig: { ...prev.shaderConfig, ...patch },
    }));
  };

  const handleUpdateGuides = (patch: Partial<GuidesConfig>) => {
    setProject((prev) => ({
      ...prev,
      guidesConfig: { ...prev.guidesConfig, ...patch },
    }));
  };

  const handleUpdateVanishingPoint = (
    id: string,
    patch: Partial<VanishingPoint>
  ) => {
    setProject((prev) => ({
      ...prev,
      guidesConfig: {
        ...prev.guidesConfig,
        vanishingPoints: prev.guidesConfig.vanishingPoints.map((vp) =>
          vp.id === id ? { ...vp, ...patch } : vp
        ),
      },
    }));
  };

  const handlePlaceVanishingPoint = (x: number, y: number) => {
    setProject((prev) => {
      if (prev.guidesConfig.vanishingPoints.length >= 4) return prev;
      const idx = prev.guidesConfig.vanishingPoints.length + 1;
      const palette = ['#9A3412', '#1E3A8A', '#14532D', '#B45309'];
      const newVp: VanishingPoint = {
        id: `vp-${Date.now()}`,
        label: `VP${idx} · Convergence Axis`,
        x,
        y,
        rayCount: 12,
        color: palette[(idx - 1) % palette.length],
        enabled: true,
      };
      return {
        ...prev,
        guidesConfig: {
          ...prev.guidesConfig,
          vanishingPoints: [...prev.guidesConfig.vanishingPoints, newVp],
        },
      };
    });
    showToast('success', `Anchored Vanishing Point at (${x}%, ${y}%)`);
  };

  const handleAddVanishingPoint = () => {
    handlePlaceVanishingPoint(50, 50);
  };

  const handleRemoveVanishingPoint = (id: string) => {
    setProject((prev) => ({
      ...prev,
      guidesConfig: {
        ...prev.guidesConfig,
        vanishingPoints: prev.guidesConfig.vanishingPoints.filter(
          (vp) => vp.id !== id
        ),
      },
    }));
  };

  // Panel / Shot Bounding Box handlers
  const handleCreateAnnotation = (box: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    const newId = `panel-${Date.now()}`;
    setProject((prev) => {
      if (prev.annotations.length >= 25) return prev;
      const nextOrder = prev.annotations.length + 1;
      const palette = ['#9A3412', '#1E3A8A', '#14532D', '#B45309'];
      const newAnn: PanelAnnotation = {
        id: newId,
        order: nextOrder,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        label:
          prev.medium === 'comic'
            ? `Panel ${nextOrder} Study Region`
            : `Shot ${nextOrder} Focal Frame`,
        shotType: nextOrder === 1 ? 'wide-establishing' : 'medium-closeup',
        transitionType:
          nextOrder === 1 ? 'establishing-open' : 'action-to-action',
        notes:
          'Drawn interactively on stage. Select a Scott McCloud transition and shot scale.',
        color: palette[(nextOrder - 1) % palette.length],
      };
      return {
        ...prev,
        guidesConfig: {
          ...prev.guidesConfig,
          showPanelBoxes: true,
        },
        annotations: [...prev.annotations, newAnn],
      };
    });
    setSelectedAnnotationId(newId);
    showToast('success', 'Created new bounding box region on stage.');
  };

  const handleAddDefaultAnnotation = () => {
    const offset = (project.annotations.length * 6) % 35;
    handleCreateAnnotation({
      x: 15 + offset,
      y: 18 + offset,
      width: 32,
      height: 28,
    });
  };

  const handleUpdateAnnotation = (
    id: string,
    patch: Partial<PanelAnnotation>
  ) => {
    setProject((prev) => ({
      ...prev,
      annotations: prev.annotations.map((ann) =>
        ann.id === id ? { ...ann, ...patch } : ann
      ),
    }));
  };

  const handleRemoveAnnotation = (id: string) => {
    setProject((prev) => {
      const remaining = prev.annotations
        .filter((a) => a.id !== id)
        .sort((a, b) => a.order - b.order)
        .map((a, idx) => ({ ...a, order: idx + 1 }));
      return { ...prev, annotations: remaining };
    });
    if (selectedAnnotationId === id) {
      setSelectedAnnotationId(null);
    }
  };

  const handleReorderAnnotation = (id: string, direction: 'up' | 'down') => {
    setProject((prev) => {
      const sorted = [...prev.annotations].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((a) => a.id === id);
      if (idx === -1) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const temp = sorted[idx];
      sorted[idx] = sorted[swapIdx];
      sorted[swapIdx] = temp;
      const renumbered = sorted.map((a, i) => ({ ...a, order: i + 1 }));
      return { ...prev, annotations: renumbered };
    });
  };

  // Custom image upload handler (both from modal and quick toolbar)
  const handleUploadCustomImage = (
    dataUrl: string,
    title: string,
    medium: 'cinema' | 'comic',
    aspectRatio: string
  ) => {
    const newStudy: StudyProject = {
      id: `custom-${Date.now()}`,
      title: title.slice(0, 120),
      medium,
      creatorCredit: user?.displayName || 'Custom Studio Upload',
      year: String(new Date().getFullYear()),
      aspectRatio: aspectRatio.slice(0, 32),
      accessionNumber: `ACC. USR-${Math.floor(1000 + Math.random() * 9000)}`,
      imageUrl: dataUrl,
      curatorNotes:
        'Custom uploaded plate. Use Draw Box on Stage to tag comic panels or cinema shots, and toggle WebGL shaders to analyze tonal structure.',
      shaderConfig: {
        mode: 'original',
        contrast: 1.0,
        brightness: 0.0,
        threshold: 0.48,
        edgeStrength: 1.4,
        splitPosition: 0,
        invertEdges: true,
      },
      guidesConfig: {
        ruleOfThirds: medium === 'cinema',
        goldenSpiral: false,
        spiralOrientation: 0,
        dynamicSymmetry: false,
        centerCrosshair: false,
        horizonLine: false,
        horizonY: 50,
        showPanelBoxes: true,
        showGutterFlow: medium === 'comic',
        guideOpacity: 0.9,
        primaryGuideColor: '#9A3412',
        vanishingPoints: [
          {
            id: 'vp-custom-1',
            label: 'VP1 · Primary Convergence',
            x: 50,
            y: 50,
            rayCount: 12,
            color: '#9A3412',
            enabled: medium === 'cinema',
          },
        ],
      },
      annotations: [],
    };
    setProject(newStudy);
    setSelectedAnnotationId(null);
    showToast('success', `Loaded custom plate "${newStudy.title}"`);
  };

  const handleQuickFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
        const cleanTitle = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[-_]+/g, ' ');
        const inferredMedium: 'cinema' | 'comic' =
          w >= h * 1.15 ? 'cinema' : 'comic';
        const ratio =
          inferredMedium === 'cinema'
            ? `${(w / h).toFixed(2)}:1 Widescreen`
            : `${w}:${h} Vertical Plate`;
        handleUploadCustomImage(
          compressedDataUrl,
          cleanTitle,
          inferredMedium,
          ratio
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Apply a Style Preset
  const handleApplyPreset = (preset: StylePreset) => {
    setProject((prev) => ({
      ...prev,
      shaderConfig: { ...preset.shaderConfig },
      guidesConfig: {
        ...prev.guidesConfig,
        ...preset.guidesConfig,
        vanishingPoints:
          preset.guidesConfig.vanishingPoints ||
          prev.guidesConfig.vanishingPoints,
      },
    }));
    showToast('success', `Applied preset: ${preset.name}`);
  };

  // Save current study project to Firestore
  const handleSaveStudyToCloud = async () => {
    let activeUser = user;
    if (!activeUser) {
      try {
        const cred = await signInWithGoogle();
        activeUser = cred.user;
      } catch {
        showToast('error', 'Google sign-in was cancelled.');
        return;
      }
    }

    if (!activeUser) return;
    setIsSavingCloud(true);

    // Construct a sanitized doc ID matching ^[a-zA-Z0-9_\-]+$
    const docId =
      project.isCurated || !project.ownerId || project.ownerId !== activeUser.uid
        ? `study_${Date.now()}_${activeUser.uid.slice(0, 8).replace(/[^a-zA-Z0-9_-]/g, '')}`
        : project.id.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Enforce defensive schema boundaries matching firebase-blueprint.json & firestore.rules
    const payload = {
      title: (project.title.trim() || 'Untitled Composition Study').slice(
        0,
        120
      ),
      medium: project.medium === 'cinema' ? 'cinema' : 'comic',
      creatorCredit: (project.creatorCredit.trim() || 'Archivist').slice(
        0,
        120
      ),
      year: (project.year.trim() || '2026').slice(0, 20),
      aspectRatio: (project.aspectRatio.trim() || '16:9').slice(0, 32),
      accessionNumber: (
        project.accessionNumber.trim() || 'ACC. 2026.01'
      ).slice(0, 40),
      imageUrl: project.imageUrl.slice(0, 750000),
      curatorNotes: (project.curatorNotes || '').slice(0, 2000),
      shaderConfig: {
        mode: project.shaderConfig.mode,
        contrast: project.shaderConfig.contrast,
        brightness: project.shaderConfig.brightness,
        threshold: project.shaderConfig.threshold,
        edgeStrength: project.shaderConfig.edgeStrength,
        splitPosition: project.shaderConfig.splitPosition,
        invertEdges: project.shaderConfig.invertEdges,
      },
      guidesConfig: {
        ruleOfThirds: project.guidesConfig.ruleOfThirds,
        goldenSpiral: project.guidesConfig.goldenSpiral,
        spiralOrientation: project.guidesConfig.spiralOrientation,
        dynamicSymmetry: project.guidesConfig.dynamicSymmetry,
        centerCrosshair: project.guidesConfig.centerCrosshair,
        horizonLine: project.guidesConfig.horizonLine,
        horizonY: project.guidesConfig.horizonY,
        showPanelBoxes: project.guidesConfig.showPanelBoxes,
        showGutterFlow: project.guidesConfig.showGutterFlow,
        guideOpacity: project.guidesConfig.guideOpacity,
        primaryGuideColor: project.guidesConfig.primaryGuideColor,
        vanishingPoints: project.guidesConfig.vanishingPoints.slice(0, 4),
      },
      annotations: project.annotations.slice(0, 25).map((a, idx) => ({
        id: a.id,
        order: idx + 1,
        x: a.x,
        y: a.y,
        width: a.width,
        height: a.height,
        label: (a.label || `Region ${idx + 1}`).slice(0, 80),
        shotType: a.shotType,
        transitionType: a.transitionType,
        notes: (a.notes || '').slice(0, 400),
        color: a.color,
      })),
      ownerId: activeUser.uid,
      ownerName: (activeUser.displayName || 'Archivist').slice(0, 80),
      isPublic: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'projects', docId), payload);
      setProject((prev) => ({
        ...prev,
        id: docId,
        ownerId: activeUser?.uid,
        isCurated: false,
      }));
      showToast('success', 'Saved composition study to Firebase Archive.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `projects/${docId}`);
    } finally {
      setIsSavingCloud(false);
    }
  };

  const handleDeleteCloudProject = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'projects', id));
      showToast('success', 'Removed study from cloud archive.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `projects/${id}`);
    }
  };

  // Publish new Style Preset to Firestore
  const handleSaveNewPreset = async (
    name: string,
    description: string,
    category: 'cinema' | 'comic' | 'universal',
    isPublic: boolean
  ) => {
    if (!user) return;
    const presetId = `preset_${Date.now()}_${user.uid.slice(0, 6).replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const payload = {
      name: name.slice(0, 80),
      description: description.slice(0, 280),
      category,
      shaderConfig: {
        mode: project.shaderConfig.mode,
        contrast: project.shaderConfig.contrast,
        brightness: project.shaderConfig.brightness,
        threshold: project.shaderConfig.threshold,
        edgeStrength: project.shaderConfig.edgeStrength,
        splitPosition: project.shaderConfig.splitPosition,
        invertEdges: project.shaderConfig.invertEdges,
      },
      guidesConfig: {
        ruleOfThirds: project.guidesConfig.ruleOfThirds,
        goldenSpiral: project.guidesConfig.goldenSpiral,
        spiralOrientation: project.guidesConfig.spiralOrientation,
        dynamicSymmetry: project.guidesConfig.dynamicSymmetry,
        centerCrosshair: project.guidesConfig.centerCrosshair,
        horizonLine: project.guidesConfig.horizonLine,
        horizonY: project.guidesConfig.horizonY,
        showPanelBoxes: project.guidesConfig.showPanelBoxes,
        showGutterFlow: project.guidesConfig.showGutterFlow,
        guideOpacity: project.guidesConfig.guideOpacity,
        primaryGuideColor: project.guidesConfig.primaryGuideColor,
      },
      authorId: user.uid,
      authorName: (user.displayName || 'Archivist').slice(0, 80),
      isPublic,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'stylePresets', presetId), payload);
      showToast('success', `Published preset "${name}" to Firebase.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `stylePresets/${presetId}`);
    }
  };

  const handleDeletePreset = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'stylePresets', id));
      showToast('success', 'Removed preset from cloud gallery.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `stylePresets/${id}`);
    }
  };

  return (
    <div className="min-h-screen h-screen flex flex-col bg-[#FBF9F5] text-[#1C1917] overflow-hidden">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-[#D6CEBE] bg-[#FBF9F5] shrink-0">
        {/* Zone 1: Single Text Wordmark */}
        <a
          href="#workbench"
          onClick={(e) => {
            e.preventDefault();
            setActiveModal(null);
          }}
          className="font-serif text-xl font-bold tracking-tight text-[#1C1917] whitespace-nowrap shrink-0"
        >
          Mise &amp; Gutter
        </a>

        {/* Zone 2: 4–5 Single-Line Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#57534E]">
          <a
            href="#workbench"
            onClick={(e) => {
              e.preventDefault();
              setActiveModal(null);
            }}
            className="text-[#1C1917] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Workbench
          </a>
          <a
            href="#archive"
            onClick={(e) => {
              e.preventDefault();
              setActiveModal('archive');
            }}
            className="hover:text-[#1C1917] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Curated Archive
          </a>
          <a
            href="#upload"
            onClick={(e) => {
              e.preventDefault();
              quickUploadInputRef.current?.click();
            }}
            className="hover:text-[#1C1917] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Upload Plate
          </a>
          <a
            href="#presets"
            onClick={(e) => {
              e.preventDefault();
              setActiveModal('presets');
            }}
            className="hover:text-[#1C1917] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Style Presets
          </a>
          <a
            href="#taxonomy"
            onClick={(e) => {
              e.preventDefault();
              setActiveModal('guide');
            }}
            className="hover:text-[#1C1917] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Taxonomy Guide
          </a>
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            disabled={isSavingCloud}
            onClick={handleSaveStudyToCloud}
            className="px-4 py-2 text-xs font-medium text-[#FBF9F5] bg-[#9A3412] hover:bg-[#7C2D12] rounded transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            {isSavingCloud
              ? 'Saving Study...'
              : user
                ? 'Save Cloud Study'
                : 'Sign In & Save Study'}
          </button>
        </div>
      </header>

      {/* Hidden File Input for 1-Click Custom Upload */}
      <input
        ref={quickUploadInputRef}
        type="file"
        accept="image/*"
        onChange={handleQuickFileChange}
        className="hidden"
      />

      {/* Curatorial Plate Switcher Ribbon (below Top Bar) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2 bg-[#EBE6DF] border-b border-[#D6CEBE] text-xs shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto py-0.5">
          <span className="font-mono uppercase tracking-wider text-[11px] text-[#57534E] shrink-0">
            Active Study Plate:
          </span>
          {CURATED_STUDIES.map((st, idx) => {
            const isSelected = project.id === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => handleSelectStudy(st)}
                className={`px-2.5 py-1 rounded border transition-colors whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917] font-medium'
                    : 'bg-[#FBF9F5] text-[#57534E] border-[#D6CEBE] hover:text-[#1C1917]'
                }`}
              >
                0{idx + 1}. {st.title.split('—')[0].split('(')[0].trim()} (
                {st.medium.toUpperCase()})
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => quickUploadInputRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-[#9A3412] text-[#9A3412] bg-[#FBF9F5] hover:bg-[#9A3412] hover:text-[#FBF9F5] font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3 h-3" />
            <span>Custom Still / Page...</span>
          </button>
        </div>

        {/* Status Toast or User Session Indicator */}
        <div className="flex items-center gap-3 shrink-0">
          {statusBanner && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium ${
                statusBanner.type === 'success'
                  ? 'bg-[#14532D] text-[#FBF9F5]'
                  : 'bg-[#9A3412] text-[#FBF9F5]'
              }`}
            >
              {statusBanner.type === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5" />
              )}
              <span>{statusBanner.message}</span>
            </div>
          )}

          {user && (
            <div className="flex items-center gap-2 text-[#57534E]">
              <span>Archivist: {user.displayName || user.email}</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => signOutUser()}
                className="inline-flex items-center gap-1 text-[#1C1917] hover:underline"
              >
                <LogOut className="w-3 h-3" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* TWO-ZONE SANDBOX WORKSPACE (70% Interactive Stage / 30% Control & Concept Deck) */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
        {/* Left / Center Zone (8 cols on lg = ~67%): WebGL Shader + SVG Vector Stage */}
        <div className="lg:col-span-8 h-full min-h-[420px] overflow-hidden">
          <WebGLStage
            imageUrl={project.imageUrl}
            title={project.title}
            accessionNumber={project.accessionNumber}
            creatorCredit={project.creatorCredit}
            shaderConfig={project.shaderConfig}
            guidesConfig={project.guidesConfig}
            annotations={project.annotations}
            selectedAnnotationId={selectedAnnotationId}
            toolMode={toolMode}
            onToolModeChange={setToolMode}
            onSelectAnnotation={setSelectedAnnotationId}
            onUpdateAnnotation={handleUpdateAnnotation}
            onCreateAnnotation={handleCreateAnnotation}
            onUpdateVanishingPoint={handleUpdateVanishingPoint}
            onPlaceVanishingPoint={handlePlaceVanishingPoint}
            onUpdateGuides={handleUpdateGuides}
            onUpdateShader={handleUpdateShader}
            onMetricsComputed={setMetrics}
            exportTriggerRef={exportTriggerRef}
          />
        </div>

        {/* Right Zone (4 cols on lg = ~33%): Control & Concept Deck */}
        <div className="lg:col-span-4 h-full overflow-hidden">
          <InspectorDeck
            project={project}
            metrics={metrics}
            selectedAnnotationId={selectedAnnotationId}
            toolMode={toolMode}
            onToolModeChange={setToolMode}
            onSelectAnnotation={setSelectedAnnotationId}
            onUpdateProjectMeta={handleUpdateProjectMeta}
            onUpdateShader={handleUpdateShader}
            onUpdateGuides={handleUpdateGuides}
            onUpdateVanishingPoint={handleUpdateVanishingPoint}
            onAddVanishingPoint={handleAddVanishingPoint}
            onRemoveVanishingPoint={handleRemoveVanishingPoint}
            onUpdateAnnotation={handleUpdateAnnotation}
            onAddDefaultAnnotation={handleAddDefaultAnnotation}
            onRemoveAnnotation={handleRemoveAnnotation}
            onReorderAnnotation={handleReorderAnnotation}
          />
        </div>
      </main>

      {/* Modals for Archive, Style Presets, and Taxonomy Guide */}
      <ArchiveModal
        isOpen={activeModal === 'archive'}
        onClose={() => setActiveModal(null)}
        curatedStudies={CURATED_STUDIES}
        cloudProjects={cloudProjects}
        activeProjectId={project.id}
        currentUserUid={user?.uid || null}
        onSelectStudy={handleSelectStudy}
        onUploadCustomImage={handleUploadCustomImage}
        onDeleteCloudProject={handleDeleteCloudProject}
      />

      <PresetsModal
        isOpen={activeModal === 'presets'}
        onClose={() => setActiveModal(null)}
        builtInPresets={BUILT_IN_PRESETS}
        cloudPresets={cloudPresets}
        currentUserUid={user?.uid || null}
        onApplyPreset={handleApplyPreset}
        onSaveNewPreset={handleSaveNewPreset}
        onDeletePreset={handleDeletePreset}
        onRequestSignIn={async () => {
          await signInWithGoogle();
        }}
      />

      <TaxonomyGuideModal
        isOpen={activeModal === 'guide'}
        onClose={() => setActiveModal(null)}
      />
    </div>
  );
}
