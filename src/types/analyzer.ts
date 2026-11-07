export type MediumType = 'cinema' | 'comic';

export type ShaderMode =
  | 'original'
  | 'luminance'
  | 'sobel'
  | 'notan'
  | 'posterize';

export interface ShaderConfig {
  mode: ShaderMode;
  contrast: number; // 0.5 to 2.0 (default 1.0)
  brightness: number; // -0.5 to 0.5 (default 0.0)
  threshold: number; // 0.05 to 0.95 (default 0.48, used in Notan)
  edgeStrength: number; // 0.5 to 3.0 (default 1.4, used in Sobel)
  splitPosition: number; // 0 to 100 (% wipe between original and shader, default 0 = full shader)
  invertEdges: boolean; // true = black ink lines on archival cream paper
}

export interface VanishingPoint {
  id: string;
  label: string;
  x: number; // 0 to 100 (%)
  y: number; // 0 to 100 (%)
  rayCount: number; // 4 to 24
  color: string;
  enabled: boolean;
}

export type SpiralOrientation = 0 | 90 | 180 | 270;

export interface GuidesConfig {
  ruleOfThirds: boolean;
  goldenSpiral: boolean;
  spiralOrientation: SpiralOrientation;
  dynamicSymmetry: boolean;
  centerCrosshair: boolean;
  horizonLine: boolean;
  horizonY: number; // 0 to 100 (%)
  showPanelBoxes: boolean;
  showGutterFlow: boolean;
  guideOpacity: number; // 0.2 to 1.0
  primaryGuideColor: string;
  vanishingPoints: VanishingPoint[];
}

export type McCloudTransition =
  | 'moment-to-moment'
  | 'action-to-action'
  | 'subject-to-subject'
  | 'scene-to-scene'
  | 'aspect-to-aspect'
  | 'non-sequitur'
  | 'establishing-open';

export type CinemaShotType =
  | 'extreme-wide'
  | 'wide-establishing'
  | 'medium-full'
  | 'medium-closeup'
  | 'closeup'
  | 'extreme-closeup'
  | 'over-the-shoulder'
  | 'low-angle'
  | 'high-angle'
  | 'dutch-tilt'
  | 'one-point-perspective';

export interface PanelAnnotation {
  id: string;
  order: number;
  x: number; // 0 to 100 (%)
  y: number; // 0 to 100 (%)
  width: number; // 2 to 100 (%)
  height: number; // 2 to 100 (%)
  label: string;
  shotType: CinemaShotType;
  transitionType: McCloudTransition;
  notes: string;
  color: string;
}

export interface StudyProject {
  id: string;
  title: string;
  medium: MediumType;
  creatorCredit: string;
  year: string;
  aspectRatio: string;
  accessionNumber: string;
  imageUrl: string;
  curatorNotes: string;
  shaderConfig: ShaderConfig;
  guidesConfig: GuidesConfig;
  annotations: PanelAnnotation[];
  ownerId?: string;
  ownerName?: string;
  isPublic?: boolean;
  isCurated?: boolean;
}

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  category: 'cinema' | 'comic' | 'universal';
  shaderConfig: ShaderConfig;
  guidesConfig: Omit<GuidesConfig, 'vanishingPoints'> & {
    vanishingPoints?: VanishingPoint[];
  };
  authorId?: string;
  authorName?: string;
  isPublic?: boolean;
  isBuiltIn?: boolean;
}

export type StageToolMode = 'select' | 'draw-panel' | 'place-vp';

export interface LuminanceMetrics {
  meanLuminance: number; // 0..100 IRE
  shadowRatio: number; // % pixels < 25 IRE
  midtoneRatio: number; // % pixels 25..75 IRE
  highlightRatio: number; // % pixels > 75 IRE
  contrastIndex: number; // StdDev of luminance
  histogram: number[]; // 16 bins normalized 0..100
}
