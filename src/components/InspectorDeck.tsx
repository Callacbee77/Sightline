import React, { useState } from 'react';
import {
  StudyProject,
  ShaderConfig,
  ShaderMode,
  GuidesConfig,
  PanelAnnotation,
  VanishingPoint,
  McCloudTransition,
  CinemaShotType,
  StageToolMode,
  LuminanceMetrics,
} from '../types/analyzer';
import {
  MCCLOUD_TRANSITION_META,
  CINEMA_SHOT_META,
} from '../data/curatedStudies';
import {
  Sliders,
  Compass,
  LayoutGrid,
  FileText,
  Plus,
  Trash2,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Crosshair,
  SquarePlus,
} from 'lucide-react';

interface InspectorDeckProps {
  project: StudyProject;
  metrics: LuminanceMetrics;
  selectedAnnotationId: string | null;
  toolMode: StageToolMode;
  onToolModeChange: (mode: StageToolMode) => void;
  onSelectAnnotation: (id: string | null) => void;
  onUpdateProjectMeta: (patch: Partial<StudyProject>) => void;
  onUpdateShader: (patch: Partial<ShaderConfig>) => void;
  onUpdateGuides: (patch: Partial<GuidesConfig>) => void;
  onUpdateVanishingPoint: (id: string, patch: Partial<VanishingPoint>) => void;
  onAddVanishingPoint: () => void;
  onRemoveVanishingPoint: (id: string) => void;
  onUpdateAnnotation: (id: string, patch: Partial<PanelAnnotation>) => void;
  onAddDefaultAnnotation: () => void;
  onRemoveAnnotation: (id: string) => void;
  onReorderAnnotation: (id: string, direction: 'up' | 'down') => void;
}

type InspectorTab = 'panels' | 'shaders' | 'geometry' | 'accession';

const SHADER_MODES: {
  id: ShaderMode;
  label: string;
  subtitle: string;
}[] = [
  {
    id: 'original',
    label: '01. Original Plate',
    subtitle: 'Full-color or native ink scan with tonal grading',
  },
  {
    id: 'luminance',
    label: '02. Luminance Heatmap',
    subtitle: 'Calibrated 5-stop IRE exposure & contrast zone map',
  },
  {
    id: 'sobel',
    label: '03. Sobel Edge Contours',
    subtitle: 'Isolates structural linework, gutters & silhouettes',
  },
  {
    id: 'notan',
    label: '04. 2-Tone Notan Balance',
    subtitle: 'Binary black/white mass study for positive/negative space',
  },
  {
    id: 'posterize',
    label: '05. 5-Value Posterization',
    subtitle: 'Groups continuous gradients into 5 discrete print values',
  },
];

const DRAFTING_SWATCHES = [
  { label: 'Terracotta Ink', hex: '#9A3412' },
  { label: 'Deep Lapis', hex: '#1E3A8A' },
  { label: 'Forest Ink', hex: '#14532D' },
  { label: 'Ochre Bronze', hex: '#B45309' },
  { label: 'Alabaster Chalk', hex: '#FBF9F5' },
  { label: 'Antique Charcoal', hex: '#1C1917' },
];

export const InspectorDeck: React.FC<InspectorDeckProps> = ({
  project,
  metrics,
  selectedAnnotationId,
  toolMode,
  onToolModeChange,
  onSelectAnnotation,
  onUpdateProjectMeta,
  onUpdateShader,
  onUpdateGuides,
  onUpdateVanishingPoint,
  onAddVanishingPoint,
  onRemoveVanishingPoint,
  onUpdateAnnotation,
  onAddDefaultAnnotation,
  onRemoveAnnotation,
  onReorderAnnotation,
}) => {
  const [activeTab, setActiveTab] = useState<InspectorTab>('panels');

  const { shaderConfig, guidesConfig, annotations } = project;
  const sortedAnnotations = [...annotations].sort((a, b) => a.order - b.order);
  const selectedAnnotation =
    sortedAnnotations.find((a) => a.id === selectedAnnotationId) ||
    sortedAnnotations[0] ||
    null;

  // Compute Scott McCloud transition breakdown across the active plate
  const transitionCounts = sortedAnnotations.reduce<
    Record<McCloudTransition, number>
  >(
    (acc, item) => {
      acc[item.transitionType] = (acc[item.transitionType] || 0) + 1;
      return acc;
    },
    {
      'establishing-open': 0,
      'moment-to-moment': 0,
      'action-to-action': 0,
      'subject-to-subject': 0,
      'scene-to-scene': 0,
      'aspect-to-aspect': 0,
      'non-sequitur': 0,
    }
  );

  return (
    <aside className="flex flex-col h-full bg-[#FBF9F5] text-[#1C1917] overflow-hidden">
      {/* Editorial Chapter Switcher */}
      <div className="grid grid-cols-4 border-b border-[#D6CEBE] bg-[#EBE6DF]">
        <button
          type="button"
          onClick={() => setActiveTab('panels')}
          className={`flex flex-col items-center justify-center py-2.5 px-2 text-xs font-medium border-r border-[#D6CEBE] transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'panels'
              ? 'bg-[#FBF9F5] text-[#9A3412] font-semibold'
              : 'text-[#57534E] hover:text-[#1C1917]'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5 mb-1" />
          <span>01. Panels ({annotations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('shaders')}
          className={`flex flex-col items-center justify-center py-2.5 px-2 text-xs font-medium border-r border-[#D6CEBE] transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'shaders'
              ? 'bg-[#FBF9F5] text-[#9A3412] font-semibold'
              : 'text-[#57534E] hover:text-[#1C1917]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 mb-1" />
          <span>02. Shaders</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('geometry')}
          className={`flex flex-col items-center justify-center py-2.5 px-2 text-xs font-medium border-r border-[#D6CEBE] transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'geometry'
              ? 'bg-[#FBF9F5] text-[#9A3412] font-semibold'
              : 'text-[#57534E] hover:text-[#1C1917]'
          }`}
        >
          <Compass className="w-3.5 h-3.5 mb-1" />
          <span>03. Geometry</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('accession')}
          className={`flex flex-col items-center justify-center py-2.5 px-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'accession'
              ? 'bg-[#FBF9F5] text-[#9A3412] font-semibold'
              : 'text-[#57534E] hover:text-[#1C1917]'
          }`}
        >
          <FileText className="w-3.5 h-3.5 mb-1" />
          <span>04. Catalog</span>
        </button>
      </div>

      {/* Scrollable Inspector Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* TAB 01: PANELS, BOUNDING BOXES & SCOTT MCCLOUD TRANSITIONS */}
        {activeTab === 'panels' && (
          <div className="space-y-6">
            {/* Section Header + Primary Draw Affordances */}
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="font-serif text-lg font-semibold text-[#1C1917]">
                  Panel Bounding Boxes &amp; Transitions
                </h2>
                <span className="text-xs font-mono tabular-nums text-[#57534E]">
                  {annotations.length} / 25 Max
                </span>
              </div>
              <p className="text-xs text-[#57534E] leading-relaxed">
                Draw rectangular bounding boxes over comic panels or cinema subjects
                to classify shot scale and Scott McCloud gutter transitions.
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    onToolModeChange(
                      toolMode === 'draw-panel' ? 'select' : 'draw-panel'
                    )
                  }
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 ${
                    toolMode === 'draw-panel'
                      ? 'bg-[#9A3412] text-[#FBF9F5] border-[#9A3412]'
                      : 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917] hover:bg-[#292524]'
                  }`}
                >
                  <SquarePlus className="w-3.5 h-3.5" />
                  <span>
                    {toolMode === 'draw-panel'
                      ? 'Drawing Active...'
                      : 'Draw Box on Stage'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onAddDefaultAnnotation}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium bg-[#EBE6DF] text-[#1C1917] hover:bg-[#D6CEBE] border border-[#D6CEBE] rounded transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Quick-Add Box</span>
                </button>
              </div>

              {/* Visibilty toggles for Boxes and Gutter Reading Vectors */}
              <div className="flex items-center justify-between pt-2 border-t border-[#EBE6DF] text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-[#1C1917]">
                  <input
                    type="checkbox"
                    checked={guidesConfig.showPanelBoxes}
                    onChange={(e) =>
                      onUpdateGuides({ showPanelBoxes: e.target.checked })
                    }
                    className="accent-[#9A3412] rounded"
                  />
                  <span>Show Bounding Boxes</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-[#1C1917]">
                  <input
                    type="checkbox"
                    checked={guidesConfig.showGutterFlow}
                    onChange={(e) =>
                      onUpdateGuides({ showGutterFlow: e.target.checked })
                    }
                    className="accent-[#9A3412] rounded"
                  />
                  <span>Gutter Reading Vectors (1→2)</span>
                </label>
              </div>
            </div>

            {/* Sequence List */}
            <div className="space-y-2 border-t border-[#D6CEBE] pt-4">
              <div className="flex items-center justify-between text-xs text-[#57534E]">
                <span className="font-medium uppercase tracking-wider">
                  Sequential Reading Order
                </span>
                <span>Click row to inspect</span>
              </div>

              {sortedAnnotations.length === 0 ? (
                <div className="p-4 border border-[#D6CEBE] bg-[#EBE6DF]/50 rounded text-center space-y-2">
                  <p className="text-xs text-[#57534E]">
                    No panel or shot bounding boxes defined on this plate yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => onToolModeChange('draw-panel')}
                    className="px-3 py-1.5 text-xs font-medium bg-[#9A3412] text-[#FBF9F5] rounded"
                  >
                    Click &amp; Drag on Stage to Draw
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {sortedAnnotations.map((ann, idx) => {
                    const isSelected = selectedAnnotation?.id === ann.id;
                    const mcMeta = MCCLOUD_TRANSITION_META[ann.transitionType];
                    const shotMeta = CINEMA_SHOT_META[ann.shotType];
                    return (
                      <div
                        key={ann.id}
                        onClick={() => onSelectAnnotation(ann.id)}
                        className={`flex items-center justify-between gap-2 p-2.5 rounded border cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#EBE6DF] border-[#9A3412]'
                            : 'bg-[#FBF9F5] border-[#D6CEBE] hover:bg-[#EBE6DF]/60'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-xs shrink-0"
                              style={{ backgroundColor: ann.color }}
                            />
                            <span className="font-mono text-xs font-semibold tabular-nums text-[#1C1917]">
                              #{String(ann.order).padStart(2, '0')}
                            </span>
                            <span className="text-xs font-medium text-[#1C1917] truncate">
                              {ann.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-[#57534E] font-mono mt-0.5 pl-4">
                            <span>{mcMeta.name.replace(/^\d+\.\s*/, '')}</span>
                            <span aria-hidden="true">·</span>
                            <span>{shotMeta.code}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">
                              {ann.width.toFixed(0)}×{ann.height.toFixed(0)}%
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              onReorderAnnotation(ann.id, 'up');
                            }}
                            className="p-1 text-[#57534E] hover:text-[#1C1917] disabled:opacity-30"
                            title="Move Earlier in Reading Order"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === sortedAnnotations.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              onReorderAnnotation(ann.id, 'down');
                            }}
                            className="p-1 text-[#57534E] hover:text-[#1C1917] disabled:opacity-30"
                            title="Move Later in Reading Order"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveAnnotation(ann.id);
                            }}
                            className="p-1 text-[#57534E] hover:text-[#9A3412]"
                            title="Delete Panel Box"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Active Panel / Shot Inspector Detail Form */}
            {selectedAnnotation && (
              <div className="space-y-4 border-t border-[#D6CEBE] pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-sm font-semibold text-[#1C1917]">
                    Inspecting Region #
                    {String(selectedAnnotation.order).padStart(2, '0')}
                  </h3>
                  <span className="text-[11px] font-mono tabular-nums text-[#57534E]">
                    X:{selectedAnnotation.x.toFixed(1)}% · Y:
                    {selectedAnnotation.y.toFixed(1)}%
                  </span>
                </div>

                {/* Label Input */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-[#57534E]">
                    Region / Panel Title
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={selectedAnnotation.label}
                    onChange={(e) =>
                      onUpdateAnnotation(selectedAnnotation.id, {
                        label: e.target.value,
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs bg-[#FBF9F5] border border-[#D6CEBE] rounded text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                {/* Scott McCloud Transition Selector */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-[#57534E]">
                    Scott McCloud Gutter Transition (from previous panel)
                  </label>
                  <select
                    value={selectedAnnotation.transitionType}
                    onChange={(e) =>
                      onUpdateAnnotation(selectedAnnotation.id, {
                        transitionType: e.target.value as McCloudTransition,
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-[#D6CEBE] rounded text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
                  >
                    {(
                      Object.keys(MCCLOUD_TRANSITION_META) as McCloudTransition[]
                    ).map((key) => (
                      <option key={key} value={key}>
                        {MCCLOUD_TRANSITION_META[key].name} (
                        {MCCLOUD_TRANSITION_META[key].code})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-[#57534E] italic pt-0.5">
                    {
                      MCCLOUD_TRANSITION_META[selectedAnnotation.transitionType]
                        .shortDesc
                    }
                  </p>
                </div>

                {/* Cinema Shot Scale / Framing Selector */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-[#57534E]">
                    Cinema Shot Scale &amp; Camera Angle
                  </label>
                  <select
                    value={selectedAnnotation.shotType}
                    onChange={(e) =>
                      onUpdateAnnotation(selectedAnnotation.id, {
                        shotType: e.target.value as CinemaShotType,
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-[#D6CEBE] rounded text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
                  >
                    {(Object.keys(CINEMA_SHOT_META) as CinemaShotType[]).map(
                      (key) => (
                        <option key={key} value={key}>
                          {CINEMA_SHOT_META[key].name} ({CINEMA_SHOT_META[key].code}
                          )
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* Bounding Box Color Swatches */}
                <div className="space-y-1.5">
                  <span className="block text-xs font-medium text-[#57534E]">
                    Drafting Ink Swatch
                  </span>
                  <div className="flex items-center gap-2">
                    {DRAFTING_SWATCHES.slice(0, 4).map((sw) => (
                      <button
                        key={sw.hex}
                        type="button"
                        onClick={() =>
                          onUpdateAnnotation(selectedAnnotation.id, {
                            color: sw.hex,
                          })
                        }
                        className={`w-6 h-6 rounded border ${
                          selectedAnnotation.color === sw.hex
                            ? 'ring-2 ring-offset-1 ring-[#1C1917] border-white'
                            : 'border-[#D6CEBE]'
                        }`}
                        style={{ backgroundColor: sw.hex }}
                        title={sw.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Analytical Notes */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-[#57534E]">
                    Compositional &amp; Narrative Notes
                  </label>
                  <textarea
                    rows={3}
                    maxLength={400}
                    value={selectedAnnotation.notes}
                    onChange={(e) =>
                      onUpdateAnnotation(selectedAnnotation.id, {
                        notes: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-[#D6CEBE] rounded text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
                    placeholder="Document framing, eye-trace vector, or closure mechanics..."
                  />
                </div>
              </div>
            )}

            {/* McCloud Transition Taxonomy Distribution Bar */}
            {sortedAnnotations.length > 0 && (
              <div className="border-t border-[#D6CEBE] pt-4 space-y-2.5">
                <span className="block text-xs font-medium uppercase tracking-wider text-[#57534E]">
                  McCloud Transition Breakdown
                </span>
                <div className="space-y-1.5">
                  {(
                    Object.keys(MCCLOUD_TRANSITION_META) as McCloudTransition[]
                  ).map((key) => {
                    const count = transitionCounts[key] || 0;
                    if (count === 0) return null;
                    const pct = Math.round(
                      (count / sortedAnnotations.length) * 100
                    );
                    const meta = MCCLOUD_TRANSITION_META[key];
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#1C1917] font-medium">
                            {meta.name}
                          </span>
                          <span className="font-mono tabular-nums text-[#57534E]">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[#EBE6DF] rounded-xs overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: meta.badgeColor,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 02: WEBGL OPTICAL SHADERS & LUMINANCE TELEMETRY */}
        {activeTab === 'shaders' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-lg font-semibold text-[#1C1917]">
                  WebGL Optical Shaders
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateShader({
                      mode: 'original',
                      contrast: 1.0,
                      brightness: 0.0,
                      threshold: 0.48,
                      edgeStrength: 1.4,
                      splitPosition: 0,
                    })
                  }
                  className="flex items-center gap-1 text-xs text-[#9A3412] hover:underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Optics</span>
                </button>
              </div>
              <p className="text-xs text-[#57534E] leading-relaxed">
                Real-time GLSL fragment shaders evaluate tonal distribution,
                exposure zones, and structural line contours across the plate.
              </p>
            </div>

            {/* Shader Pass Radio Cards */}
            <div className="space-y-2">
              {SHADER_MODES.map((m) => {
                const active = shaderConfig.mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onUpdateShader({ mode: m.id })}
                    className={`w-full text-left p-3 rounded border transition-colors ${
                      active
                        ? 'bg-[#EBE6DF] border-[#9A3412]'
                        : 'bg-[#FBF9F5] border-[#D6CEBE] hover:bg-[#EBE6DF]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#1C1917]">
                        {m.label}
                      </span>
                      <span className="text-[11px] font-mono uppercase text-[#9A3412]">
                        {active ? 'ACTIVE PASS' : ''}
                      </span>
                    </div>
                    <p className="text-xs text-[#57534E] mt-0.5">{m.subtitle}</p>
                  </button>
                );
              })}
            </div>

            {/* Parameter Sliders */}
            <div className="space-y-4 border-t border-[#D6CEBE] pt-4">
              {/* Contrast Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-[#1C1917]">
                    Optical Contrast Gain
                  </label>
                  <span className="font-mono tabular-nums text-[#57534E]">
                    {shaderConfig.contrast.toFixed(2)}×
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.02"
                  value={shaderConfig.contrast}
                  onChange={(e) =>
                    onUpdateShader({ contrast: parseFloat(e.target.value) })
                  }
                  className="w-full editorial-slider"
                />
              </div>

              {/* Brightness / Exposure Offset */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-[#1C1917]">
                    Exposure Bias (Brightness)
                  </label>
                  <span className="font-mono tabular-nums text-[#57534E]">
                    {shaderConfig.brightness >= 0 ? '+' : ''}
                    {Math.round(shaderConfig.brightness * 100)} IRE
                  </span>
                </div>
                <input
                  type="range"
                  min="-0.4"
                  max="0.4"
                  step="0.02"
                  value={shaderConfig.brightness}
                  onChange={(e) =>
                    onUpdateShader({ brightness: parseFloat(e.target.value) })
                  }
                  className="w-full editorial-slider"
                />
              </div>

              {/* Notan Threshold Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-[#1C1917]">
                    Notan Binary Threshold
                  </label>
                  <span className="font-mono tabular-nums text-[#57534E]">
                    {Math.round(shaderConfig.threshold * 100)}% Luma
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.01"
                  value={shaderConfig.threshold}
                  onChange={(e) =>
                    onUpdateShader({ threshold: parseFloat(e.target.value) })
                  }
                  className="w-full editorial-slider"
                />
              </div>

              {/* Sobel Edge Sensitivity Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-[#1C1917]">
                    Sobel Kernel Edge Gain
                  </label>
                  <span className="font-mono tabular-nums text-[#57534E]">
                    {shaderConfig.edgeStrength.toFixed(2)}×
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.05"
                  value={shaderConfig.edgeStrength}
                  onChange={(e) =>
                    onUpdateShader({ edgeStrength: parseFloat(e.target.value) })
                  }
                  className="w-full editorial-slider"
                />
              </div>

              {/* Split-Screen Wipe Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-[#1C1917]">
                    Comparison Split-Screen Wipe
                  </label>
                  <span className="font-mono tabular-nums text-[#57534E]">
                    {shaderConfig.splitPosition}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={shaderConfig.splitPosition}
                  onChange={(e) =>
                    onUpdateShader({ splitPosition: parseInt(e.target.value, 10) })
                  }
                  className="w-full editorial-slider"
                />
              </div>

              {shaderConfig.mode === 'sobel' && (
                <label className="flex items-center gap-2 pt-1 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shaderConfig.invertEdges}
                    onChange={(e) =>
                      onUpdateShader({ invertEdges: e.target.checked })
                    }
                    className="accent-[#9A3412]"
                  />
                  <span>Render as Charcoal Ink on Warm Archival Paper</span>
                </label>
              )}
            </div>

            {/* Live Luminance Histogram & Zone Distribution */}
            <div className="space-y-3 border-t border-[#D6CEBE] pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-[#57534E]">
                  Luminance Distribution (16-Stop IRE)
                </span>
                <span className="text-xs font-mono tabular-nums text-[#1C1917]">
                  Mean: {metrics.meanLuminance} IRE
                </span>
              </div>

              {/* 16-Bin Bar Histogram */}
              <div className="h-20 flex items-end gap-1 p-2 bg-[#EBE6DF] border border-[#D6CEBE] rounded">
                {metrics.histogram.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-[#1C1917] transition-all duration-150"
                    style={{
                      height: `${Math.max(4, h)}%`,
                      backgroundColor:
                        i < 4
                          ? '#1E3A8A'
                          : i < 12
                            ? '#1C1917'
                            : '#9A3412',
                    }}
                    title={`Stop ${i + 1}: ${h}% peak density`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs tabular-nums">
                <div className="p-2 bg-[#EBE6DF] rounded border border-[#D6CEBE]">
                  <div className="text-[10px] text-[#57534E]">SHADOWS</div>
                  <div className="font-semibold text-[#1E3A8A] mt-0.5">
                    {metrics.shadowRatio}%
                  </div>
                </div>
                <div className="p-2 bg-[#EBE6DF] rounded border border-[#D6CEBE]">
                  <div className="text-[10px] text-[#57534E]">MIDTONES</div>
                  <div className="font-semibold text-[#1C1917] mt-0.5">
                    {metrics.midtoneRatio}%
                  </div>
                </div>
                <div className="p-2 bg-[#EBE6DF] rounded border border-[#D6CEBE]">
                  <div className="text-[10px] text-[#57534E]">HIGHLIGHTS</div>
                  <div className="font-semibold text-[#9A3412] mt-0.5">
                    {metrics.highlightRatio}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 03: GEOMETRIC ARMATURES & PERSPECTIVE VANISHING POINTS */}
        {activeTab === 'geometry' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="font-serif text-lg font-semibold text-[#1C1917]">
                Geometric Armatures &amp; Perspective
              </h2>
              <p className="text-xs text-[#57534E] leading-relaxed">
                Overlay classical harmonic grids and draggable vanishing point
                convergence rays directly on the study plate.
              </p>
            </div>

            {/* Classical Grid Checkboxes */}
            <div className="space-y-2.5">
              <label className="flex items-center justify-between p-2.5 bg-[#EBE6DF]/60 border border-[#D6CEBE] rounded cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-[#1C1917]">
                    Rule of Thirds + Power Reticles
                  </div>
                  <div className="text-[11px] text-[#57534E]">
                    3×3 harmonic grid with 4 focal intersection markers
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={guidesConfig.ruleOfThirds}
                  onChange={(e) =>
                    onUpdateGuides({ ruleOfThirds: e.target.checked })
                  }
                  className="accent-[#9A3412] w-4 h-4"
                />
              </label>

              <div className="p-2.5 bg-[#EBE6DF]/60 border border-[#D6CEBE] rounded space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="text-xs font-semibold text-[#1C1917]">
                      Fibonacci Golden Spiral (1:1.618)
                    </div>
                    <div className="text-[11px] text-[#57534E]">
                      Logarithmic spiral + golden section subdivisions
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={guidesConfig.goldenSpiral}
                    onChange={(e) =>
                      onUpdateGuides({ goldenSpiral: e.target.checked })
                    }
                    className="accent-[#9A3412] w-4 h-4"
                  />
                </label>

                {guidesConfig.goldenSpiral && (
                  <div className="flex items-center gap-1 pt-1">
                    {([0, 90, 180, 270] as const).map((deg) => (
                      <button
                        key={deg}
                        type="button"
                        onClick={() =>
                          onUpdateGuides({ spiralOrientation: deg })
                        }
                        className={`flex-1 py-1 text-xs font-mono rounded border ${
                          guidesConfig.spiralOrientation === deg
                            ? 'bg-[#9A3412] text-[#FBF9F5] border-[#9A3412]'
                            : 'bg-[#FBF9F5] text-[#57534E] border-[#D6CEBE]'
                        }`}
                      >
                        {deg}°
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex items-center justify-between p-2.5 bg-[#EBE6DF]/60 border border-[#D6CEBE] rounded cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-[#1C1917]">
                    Dynamic Symmetry (Baroque &amp; Sinister)
                  </div>
                  <div className="text-[11px] text-[#57534E]">
                    Primary corner diagonals with reciprocal perpendiculars
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={guidesConfig.dynamicSymmetry}
                  onChange={(e) =>
                    onUpdateGuides({ dynamicSymmetry: e.target.checked })
                  }
                  className="accent-[#9A3412] w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 bg-[#EBE6DF]/60 border border-[#D6CEBE] rounded cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-[#1C1917]">
                    Center Symmetry Crosshair
                  </div>
                  <div className="text-[11px] text-[#57534E]">
                    Orthogonal 50% vertical and horizontal bisectors
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={guidesConfig.centerCrosshair}
                  onChange={(e) =>
                    onUpdateGuides({ centerCrosshair: e.target.checked })
                  }
                  className="accent-[#9A3412] w-4 h-4"
                />
              </label>

              <div className="p-2.5 bg-[#EBE6DF]/60 border border-[#D6CEBE] rounded space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="text-xs font-semibold text-[#1C1917]">
                      Diegetic Horizon Line
                    </div>
                    <div className="text-[11px] text-[#57534E]">
                      Draggable camera eye-level elevation axis
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={guidesConfig.horizonLine}
                    onChange={(e) =>
                      onUpdateGuides({ horizonLine: e.target.checked })
                    }
                    className="accent-[#9A3412] w-4 h-4"
                  />
                </label>

                {guidesConfig.horizonLine && (
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-xs font-mono tabular-nums">
                      <span>Horizon Elevation Y</span>
                      <span>{guidesConfig.horizonY.toFixed(1)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.5"
                      value={guidesConfig.horizonY}
                      onChange={(e) =>
                        onUpdateGuides({
                          horizonY: parseFloat(e.target.value),
                        })
                      }
                      className="w-full editorial-slider"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Armature Opacity & Color Swatches */}
            <div className="space-y-3 border-t border-[#D6CEBE] pt-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-[#1C1917]">
                    Vector Armature Opacity
                  </label>
                  <span className="font-mono tabular-nums text-[#57534E]">
                    {Math.round(guidesConfig.guideOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.05"
                  value={guidesConfig.guideOpacity}
                  onChange={(e) =>
                    onUpdateGuides({
                      guideOpacity: parseFloat(e.target.value),
                    })
                  }
                  className="w-full editorial-slider"
                />
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-[#57534E]">
                  Primary Armature Ink Color
                </span>
                <div className="flex items-center gap-2">
                  {DRAFTING_SWATCHES.map((sw) => (
                    <button
                      key={sw.hex}
                      type="button"
                      onClick={() =>
                        onUpdateGuides({ primaryGuideColor: sw.hex })
                      }
                      className={`w-6 h-6 rounded border ${
                        guidesConfig.primaryGuideColor === sw.hex
                          ? 'ring-2 ring-offset-1 ring-[#1C1917]'
                          : 'border-[#D6CEBE]'
                      }`}
                      style={{ backgroundColor: sw.hex }}
                      title={sw.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Vanishing Points Manager */}
            <div className="space-y-3 border-t border-[#D6CEBE] pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-[#57534E]">
                  Perspective Vanishing Points (
                  {guidesConfig.vanishingPoints.length}/4)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={guidesConfig.vanishingPoints.length >= 4}
                    onClick={() => onToolModeChange('place-vp')}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-[#1E3A8A] text-[#FBF9F5] rounded disabled:opacity-40"
                  >
                    <Crosshair className="w-3 h-3" />
                    <span>Click on Stage</span>
                  </button>
                  <button
                    type="button"
                    disabled={guidesConfig.vanishingPoints.length >= 4}
                    onClick={onAddVanishingPoint}
                    className="p-1 text-[#1C1917] bg-[#EBE6DF] border border-[#D6CEBE] rounded disabled:opacity-40"
                    title="Add Vanishing Point"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {guidesConfig.vanishingPoints.map((vp) => (
                  <div
                    key={vp.id}
                    className="p-3 bg-[#EBE6DF]/70 border border-[#D6CEBE] rounded space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs font-semibold text-[#1C1917] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={vp.enabled}
                          onChange={(e) =>
                            onUpdateVanishingPoint(vp.id, {
                              enabled: e.target.checked,
                            })
                          }
                          className="accent-[#9A3412]"
                        />
                        <span>{vp.label}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => onRemoveVanishingPoint(vp.id)}
                        className="text-[#57534E] hover:text-[#9A3412]"
                        title="Remove Vanishing Point"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums text-[#57534E]">
                      <div>
                        <span>X: {vp.x.toFixed(1)}%</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="0.5"
                          value={vp.x}
                          onChange={(e) =>
                            onUpdateVanishingPoint(vp.id, {
                              x: parseFloat(e.target.value),
                            })
                          }
                          className="w-full editorial-slider mt-1"
                        />
                      </div>
                      <div>
                        <span>Y: {vp.y.toFixed(1)}%</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="0.5"
                          value={vp.y}
                          onChange={(e) =>
                            onUpdateVanishingPoint(vp.id, {
                              y: parseFloat(e.target.value),
                            })
                          }
                          className="w-full editorial-slider mt-1"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div className="flex-1">
                        <div className="flex justify-between text-[11px] font-mono tabular-nums text-[#57534E]">
                          <span>Radiating Rays</span>
                          <span>{vp.rayCount} rays</span>
                        </div>
                        <input
                          type="range"
                          min="4"
                          max="24"
                          step="2"
                          value={vp.rayCount}
                          onChange={(e) =>
                            onUpdateVanishingPoint(vp.id, {
                              rayCount: parseInt(e.target.value, 10),
                            })
                          }
                          className="w-full editorial-slider mt-1"
                        />
                      </div>
                      <div className="flex items-center gap-1 pt-2">
                        {DRAFTING_SWATCHES.slice(0, 4).map((sw) => (
                          <button
                            key={sw.hex}
                            type="button"
                            onClick={() =>
                              onUpdateVanishingPoint(vp.id, { color: sw.hex })
                            }
                            className={`w-4 h-4 rounded-xs border ${
                              vp.color === sw.hex
                                ? 'ring-1 ring-[#1C1917]'
                                : 'border-[#D6CEBE]'
                            }`}
                            style={{ backgroundColor: sw.hex }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 04: ACCESSION CATALOG & CURATORIAL ESSAY NOTES */}
        {activeTab === 'accession' && (
          <div className="space-y-5">
            <div>
              <h2 className="font-serif text-lg font-semibold text-[#1C1917]">
                Accession Record &amp; Notes
              </h2>
              <p className="text-xs text-[#57534E] mt-0.5">
                Archival metadata included when saving to Firebase or exporting
                annotated study plates.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Study Plate Title
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={project.title}
                  onChange={(e) =>
                    onUpdateProjectMeta({ title: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-[#D6CEBE] rounded text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#57534E] mb-1">
                    Medium Classification
                  </label>
                  <select
                    value={project.medium}
                    onChange={(e) =>
                      onUpdateProjectMeta({
                        medium: e.target.value as 'cinema' | 'comic',
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-[#D6CEBE] rounded text-[#1C1917]"
                  >
                    <option value="comic">Sequential Comic Page</option>
                    <option value="cinema">Cinema Still Frame</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#57534E] mb-1">
                    Accession Number
                  </label>
                  <input
                    type="text"
                    maxLength={40}
                    value={project.accessionNumber}
                    onChange={(e) =>
                      onUpdateProjectMeta({ accessionNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-[#FBF9F5] border border-[#D6CEBE] rounded text-[#1C1917]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#57534E] mb-1">
                    Director / Artist Credit
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    value={project.creatorCredit}
                    onChange={(e) =>
                      onUpdateProjectMeta({ creatorCredit: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-[#D6CEBE] rounded text-[#1C1917]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#57534E] mb-1">
                    Year &amp; Aspect Ratio
                  </label>
                  <input
                    type="text"
                    maxLength={32}
                    value={project.aspectRatio}
                    onChange={(e) =>
                      onUpdateProjectMeta({ aspectRatio: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-[#FBF9F5] border border-[#D6CEBE] rounded text-[#1C1917]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Curatorial Composition Monograph Notes
                </label>
                <textarea
                  rows={6}
                  maxLength={2000}
                  value={project.curatorNotes}
                  onChange={(e) =>
                    onUpdateProjectMeta({ curatorNotes: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs leading-relaxed bg-[#FBF9F5] border border-[#D6CEBE] rounded text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
                  placeholder="Write formal observations on lighting ratio, gutter closure, or perspective geometry..."
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
