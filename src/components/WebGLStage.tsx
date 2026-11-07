import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import {
  ShaderConfig,
  GuidesConfig,
  PanelAnnotation,
  StageToolMode,
  LuminanceMetrics,
  VanishingPoint,
} from '../types/analyzer';
import {
  MCCLOUD_TRANSITION_META,
  CINEMA_SHOT_META,
} from '../data/curatedStudies';
import {
  MousePointer,
  SquarePlus,
  Crosshair,
  Download,
  RotateCw,
  Eye,
  EyeOff,
  Columns,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';

interface WebGLStageProps {
  imageUrl: string;
  title: string;
  accessionNumber: string;
  creatorCredit: string;
  shaderConfig: ShaderConfig;
  guidesConfig: GuidesConfig;
  annotations: PanelAnnotation[];
  selectedAnnotationId: string | null;
  toolMode: StageToolMode;
  onToolModeChange: (mode: StageToolMode) => void;
  onSelectAnnotation: (id: string | null) => void;
  onUpdateAnnotation: (id: string, patch: Partial<PanelAnnotation>) => void;
  onCreateAnnotation: (box: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  onUpdateVanishingPoint: (id: string, patch: Partial<VanishingPoint>) => void;
  onPlaceVanishingPoint: (x: number, y: number) => void;
  onUpdateGuides: (patch: Partial<GuidesConfig>) => void;
  onUpdateShader: (patch: Partial<ShaderConfig>) => void;
  onMetricsComputed: (metrics: LuminanceMetrics) => void;
  exportTriggerRef?: React.MutableRefObject<(() => void) | null>;
}

const VERTEX_SHADER_SRC = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

const FRAGMENT_SHADER_SRC = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_image;
  uniform vec2 u_resolution;
  uniform int u_mode; // 0: original, 1: luminance, 2: sobel, 3: notan, 4: posterize
  uniform float u_contrast;
  uniform float u_brightness;
  uniform float u_threshold;
  uniform float u_edgeStrength;
  uniform float u_splitPosition; // 0.0 to 1.0
  uniform int u_invertEdges;

  float getLuma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
  }

  vec3 applyContrastBrightness(vec3 color, float contrast, float brightness) {
    return clamp((color - 0.5) * contrast + 0.5 + brightness, 0.0, 1.0);
  }

  vec3 falseColorHeatmap(float luma) {
    // 5-stop calibrated IRE zone ramp:
    // Deep shadow (Indigo) -> Cool Shadow (Cerulean) -> Midtone (Emerald/Warm Sand) -> High (Amber) -> Peak (Crimson)
    vec3 c0 = vec3(0.11, 0.14, 0.36); // 0% IRE
    vec3 c1 = vec3(0.08, 0.45, 0.68); // 25% IRE
    vec3 c2 = vec3(0.16, 0.62, 0.42); // 50% IRE
    vec3 c3 = vec3(0.92, 0.64, 0.12); // 75% IRE
    vec3 c4 = vec3(0.78, 0.16, 0.12); // 100% IRE
    if (luma < 0.25) {
      return mix(c0, c1, luma / 0.25);
    } else if (luma < 0.5) {
      return mix(c1, c2, (luma - 0.25) / 0.25);
    } else if (luma < 0.75) {
      return mix(c2, c3, (luma - 0.5) / 0.25);
    } else {
      return mix(c3, c4, (luma - 0.75) / 0.25);
    }
  }

  void main() {
    vec4 rawTex = texture2D(u_image, v_texCoord);
    vec3 baseColor = applyContrastBrightness(rawTex.rgb, u_contrast, u_brightness);

    // Split-screen comparison wipe: left of u_splitPosition renders original image
    if (u_splitPosition > 0.01 && v_texCoord.x < u_splitPosition) {
      gl_FragColor = vec4(rawTex.rgb, 1.0);
      return;
    }

    if (u_mode == 0) {
      gl_FragColor = vec4(baseColor, 1.0);
      return;
    }

    float luma = getLuma(baseColor);

    if (u_mode == 1) {
      // Luminance False-Color Heatmap
      gl_FragColor = vec4(falseColorHeatmap(luma), 1.0);
      return;
    }

    if (u_mode == 2) {
      // Sobel Edge Detection
      vec2 texel = vec2(1.0 / max(u_resolution.x, 1.0), 1.0 / max(u_resolution.y, 1.0));
      float tl = getLuma(applyContrastBrightness(texture2D(u_image, v_texCoord + texel * vec2(-1.0, -1.0)).rgb, u_contrast, u_brightness));
      float tm = getLuma(applyContrastBrightness(texture2D(u_image, v_texCoord + texel * vec2( 0.0, -1.0)).rgb, u_contrast, u_brightness));
      float tr = getLuma(applyContrastBrightness(texture2D(u_image, v_texCoord + texel * vec2( 1.0, -1.0)).rgb, u_contrast, u_brightness));
      float ml = getLuma(applyContrastBrightness(texture2D(u_image, v_texCoord + texel * vec2(-1.0,  0.0)).rgb, u_contrast, u_brightness));
      float mr = getLuma(applyContrastBrightness(texture2D(u_image, v_texCoord + texel * vec2( 1.0,  0.0)).rgb, u_contrast, u_brightness));
      float bl = getLuma(applyContrastBrightness(texture2D(u_image, v_texCoord + texel * vec2(-1.0,  1.0)).rgb, u_contrast, u_brightness));
      float bm = getLuma(applyContrastBrightness(texture2D(u_image, v_texCoord + texel * vec2( 0.0,  1.0)).rgb, u_contrast, u_brightness));
      float br = getLuma(applyContrastBrightness(texture2D(u_image, v_texCoord + texel * vec2( 1.0,  1.0)).rgb, u_contrast, u_brightness));

      float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
      float gy = -tl - 2.0 * tm - tr + bl + 2.0 * bm + br;
      float mag = clamp(length(vec2(gx, gy)) * u_edgeStrength, 0.0, 1.0);

      if (u_invertEdges == 1) {
        // Dark charcoal ink lines on warm archival paper (#FBF9F5)
        vec3 paper = vec3(0.984, 0.976, 0.961);
        vec3 ink = vec3(0.110, 0.098, 0.090);
        gl_FragColor = vec4(mix(paper, ink, mag), 1.0);
      } else {
        // Luminous drafting lines on deep charcoal
        vec3 darkBg = vec3(0.08, 0.075, 0.07);
        vec3 warmLine = vec3(0.96, 0.89, 0.76);
        gl_FragColor = vec4(mix(darkBg, warmLine, mag), 1.0);
      }
      return;
    }

    if (u_mode == 3) {
      // 2-Tone Notan Binary Study
      vec3 paper = vec3(0.984, 0.976, 0.961);
      vec3 ink = vec3(0.110, 0.098, 0.090);
      vec3 outCol = luma >= u_threshold ? paper : ink;
      gl_FragColor = vec4(outCol, 1.0);
      return;
    }

    if (u_mode == 4) {
      // 5-Value Tonal Posterization
      float levels = 5.0;
      float quantized = floor(luma * levels) / (levels - 1.0);
      vec3 paper = vec3(0.984, 0.976, 0.961);
      vec3 ink = vec3(0.110, 0.098, 0.090);
      gl_FragColor = vec4(mix(ink, paper, quantized), 1.0);
      return;
    }
  }
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('Shader compile warning:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export const WebGLStage: React.FC<WebGLStageProps> = ({
  imageUrl,
  title,
  accessionNumber,
  creatorCredit,
  shaderConfig,
  guidesConfig,
  annotations,
  selectedAnnotationId,
  toolMode,
  onToolModeChange,
  onSelectAnnotation,
  onUpdateAnnotation,
  onCreateAnnotation,
  onUpdateVanishingPoint,
  onPlaceVanishingPoint,
  onUpdateGuides,
  onUpdateShader,
  onMetricsComputed,
  exportTriggerRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  // WebGL resource refs
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const textureRef = useRef<WebGLTexture | null>(null);

  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({
    width: 1280,
    height: 720,
  });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showAllOverlays, setShowAllOverlays] = useState(true);
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(
    null
  );

  // Dragging state for Vanishing Points, Horizon, Panel Boxes, and New Box Drawing
  const [dragState, setDragState] = useState<
    | { type: 'vp'; id: string }
    | { type: 'horizon' }
    | {
        type: 'move-panel';
        id: string;
        startX: number;
        startY: number;
        origX: number;
        origY: number;
      }
    | {
        type: 'resize-panel';
        id: string;
        startX: number;
        startY: number;
        origW: number;
        origH: number;
      }
    | {
        type: 'draw-new-panel';
        startX: number;
        startY: number;
        currX: number;
        currY: number;
      }
    | { type: 'split-wipe' }
    | null
  >(null);

  // Compute luminance metrics on image load or contrast/brightness change
  const computeMetrics = useCallback(
    (img: HTMLImageElement, contrast: number, brightness: number) => {
      const sampleCanvas = document.createElement('canvas');
      const sw = 160;
      const sh = Math.max(
        90,
        Math.round((img.naturalHeight / Math.max(img.naturalWidth, 1)) * sw)
      );
      sampleCanvas.width = sw;
      sampleCanvas.height = sh;
      const ctx = sampleCanvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, sw, sh);
      const { data } = ctx.getImageData(0, 0, sw, sh);
      const bins = new Array(16).fill(0);
      let sumLuma = 0;
      let sumSq = 0;
      let shadows = 0;
      let midtones = 0;
      let highlights = 0;
      const totalPixels = sw * sh;

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i] / 255;
        let g = data[i + 1] / 255;
        let b = data[i + 2] / 255;

        r = Math.min(1, Math.max(0, (r - 0.5) * contrast + 0.5 + brightness));
        g = Math.min(1, Math.max(0, (g - 0.5) * contrast + 0.5 + brightness));
        b = Math.min(1, Math.max(0, (b - 0.5) * contrast + 0.5 + brightness));

        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        sumLuma += luma;
        sumSq += luma * luma;

        if (luma < 0.25) shadows++;
        else if (luma <= 0.75) midtones++;
        else highlights++;

        const binIdx = Math.min(15, Math.floor(luma * 16));
        bins[binIdx]++;
      }

      const maxBin = Math.max(...bins, 1);
      const normalizedHist = bins.map((count) =>
        Math.round((count / maxBin) * 100)
      );
      const mean = sumLuma / totalPixels;
      const variance = Math.max(0, sumSq / totalPixels - mean * mean);
      const stdDev = Math.sqrt(variance);

      onMetricsComputed({
        meanLuminance: Math.round(mean * 100),
        shadowRatio: Math.round((shadows / totalPixels) * 100),
        midtoneRatio: Math.round((midtones / totalPixels) * 100),
        highlightRatio: Math.round((highlights / totalPixels) * 100),
        contrastIndex: Math.round(stdDev * 100),
        histogram: normalizedHist,
      });
    },
    [onMetricsComputed]
  );

  // CPU 2D Canvas fallback renderer in case WebGL context is unavailable
  const render2DFallback = useCallback(
    (canvas: HTMLCanvasElement, img: HTMLImageElement, config: ShaderConfig) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.drawImage(img, 0, 0, w, h);

      if (
        config.mode === 'original' &&
        config.contrast === 1 &&
        config.brightness === 0
      ) {
        return;
      }

      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      const splitX = Math.floor((config.splitPosition / 100) * w);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (config.splitPosition > 1 && x < splitX) continue;
          const idx = (y * w + x) * 4;
          let r = d[idx] / 255;
          let g = d[idx + 1] / 255;
          let b = d[idx + 2] / 255;

          r = Math.min(
            1,
            Math.max(0, (r - 0.5) * config.contrast + 0.5 + config.brightness)
          );
          g = Math.min(
            1,
            Math.max(0, (g - 0.5) * config.contrast + 0.5 + config.brightness)
          );
          b = Math.min(
            1,
            Math.max(0, (b - 0.5) * config.contrast + 0.5 + config.brightness)
          );

          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

          if (config.mode === 'original') {
            d[idx] = r * 255;
            d[idx + 1] = g * 255;
            d[idx + 2] = b * 255;
          } else if (config.mode === 'notan') {
            const isLight = luma >= config.threshold;
            d[idx] = isLight ? 251 : 28;
            d[idx + 1] = isLight ? 249 : 25;
            d[idx + 2] = isLight ? 245 : 23;
          } else if (config.mode === 'posterize') {
            const q = Math.floor(luma * 5) / 4;
            d[idx] = 28 + q * (251 - 28);
            d[idx + 1] = 25 + q * (249 - 25);
            d[idx + 2] = 23 + q * (245 - 23);
          } else if (config.mode === 'luminance') {
            if (luma < 0.25) {
              d[idx] = 28;
              d[idx + 1] = 75;
              d[idx + 2] = 148;
            } else if (luma < 0.5) {
              d[idx] = 40;
              d[idx + 1] = 158;
              d[idx + 2] = 107;
            } else if (luma < 0.75) {
              d[idx] = 235;
              d[idx + 1] = 163;
              d[idx + 2] = 31;
            } else {
              d[idx] = 199;
              d[idx + 1] = 41;
              d[idx + 2] = 31;
            }
          } else if (config.mode === 'sobel') {
            const isLight = luma >= 0.5;
            d[idx] = isLight ? 251 : 45;
            d[idx + 1] = isLight ? 249 : 40;
            d[idx + 2] = isLight ? 245 : 36;
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    },
    []
  );

  // Render pass on WebGL canvas
  const renderWebGL = useCallback(() => {
    const canvas = canvasRef.current;
    const img = loadedImageRef.current;
    if (!canvas || !img || !imageLoaded) return;

    let gl = glRef.current;
    if (!gl) {
      gl =
        (canvas.getContext('webgl', {
          preserveDrawingBuffer: true,
        }) as WebGLRenderingContext | null) ||
        (canvas.getContext('experimental-webgl', {
          preserveDrawingBuffer: true,
        }) as WebGLRenderingContext | null);

      if (!gl) {
        render2DFallback(canvas, img, shaderConfig);
        return;
      }
      glRef.current = gl;

      const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
      const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
      if (!vs || !fs) {
        render2DFallback(canvas, img, shaderConfig);
        return;
      }

      const program = gl.createProgram();
      if (!program) return;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        render2DFallback(canvas, img, shaderConfig);
        return;
      }
      programRef.current = program;

      // Quad geometry
      const posBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );
      const posLoc = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      // UV coordinates (flipped Y for standard image orientation)
      const texBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]),
        gl.STATIC_DRAW
      );
      const texLoc = gl.getAttribLocation(program, 'a_texCoord');
      gl.enableVertexAttribArray(texLoc);
      gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);
    }

    const program = programRef.current;
    if (!program) {
      render2DFallback(canvas, img, shaderConfig);
      return;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);

    const modeMap: Record<ShaderConfig['mode'], number> = {
      original: 0,
      luminance: 1,
      sobel: 2,
      notan: 3,
      posterize: 4,
    };

    gl.uniform2f(
      gl.getUniformLocation(program, 'u_resolution'),
      canvas.width,
      canvas.height
    );
    gl.uniform1i(
      gl.getUniformLocation(program, 'u_mode'),
      modeMap[shaderConfig.mode]
    );
    gl.uniform1f(
      gl.getUniformLocation(program, 'u_contrast'),
      shaderConfig.contrast
    );
    gl.uniform1f(
      gl.getUniformLocation(program, 'u_brightness'),
      shaderConfig.brightness
    );
    gl.uniform1f(
      gl.getUniformLocation(program, 'u_threshold'),
      shaderConfig.threshold
    );
    gl.uniform1f(
      gl.getUniformLocation(program, 'u_edgeStrength'),
      shaderConfig.edgeStrength
    );
    gl.uniform1f(
      gl.getUniformLocation(program, 'u_splitPosition'),
      shaderConfig.splitPosition / 100
    );
    gl.uniform1i(
      gl.getUniformLocation(program, 'u_invertEdges'),
      shaderConfig.invertEdges ? 1 : 0
    );

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }, [imageLoaded, shaderConfig, render2DFallback]);

  // Load image into texture when imageUrl changes
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImageRef.current = img;
      const w = img.naturalWidth || 1280;
      const h = img.naturalHeight || 720;
      setImageSize({ width: w, height: h });

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = w;
        canvas.height = h;
      }

      const gl = glRef.current;
      if (gl) {
        if (textureRef.current) {
          gl.deleteTexture(textureRef.current);
        }
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          img
        );
        textureRef.current = tex;
      }

      setImageLoaded(true);
      computeMetrics(img, shaderConfig.contrast, shaderConfig.brightness);
    };
    img.onerror = () => {
      setImageError(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Re-run WebGL render whenever shaderConfig or imageLoaded updates
  useEffect(() => {
    if (!imageLoaded || !loadedImageRef.current) return;
    // Ensure texture is uploaded if gl was initialized during first renderWebGL
    const gl = glRef.current;
    if (gl && !textureRef.current && loadedImageRef.current) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        loadedImageRef.current
      );
      textureRef.current = tex;
    }
    renderWebGL();
  }, [imageLoaded, shaderConfig, renderWebGL]);

  // Recompute histogram metrics when contrast/brightness change
  useEffect(() => {
    if (imageLoaded && loadedImageRef.current) {
      computeMetrics(
        loadedImageRef.current,
        shaderConfig.contrast,
        shaderConfig.brightness
      );
    }
  }, [imageLoaded, shaderConfig.contrast, shaderConfig.brightness, computeMetrics]);

  // Convert client mouse event to normalized 0..100% coordinates on the SVG
  const getNormalizedCoords = (
    e: React.MouseEvent<SVGSVGElement | Element>
  ): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 50, y: 50 };
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 100;
    const y = ((e.clientY - rect.top) / Math.max(rect.height, 1)) * 100;
    return {
      x: Math.max(0, Math.min(100, Number(x.toFixed(1)))),
      y: Math.max(0, Math.min(100, Number(y.toFixed(1)))),
    };
  };

  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const coords = getNormalizedCoords(e);
    if (toolMode === 'place-vp') {
      onPlaceVanishingPoint(coords.x, coords.y);
      onToolModeChange('select');
      return;
    }
    if (toolMode === 'draw-panel') {
      setDragState({
        type: 'draw-new-panel',
        startX: coords.x,
        startY: coords.y,
        currX: coords.x,
        currY: coords.y,
      });
      return;
    }
    // In select mode, clicking empty canvas deselects active panel
    if (e.target === svgRef.current) {
      onSelectAnnotation(null);
    }
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const coords = getNormalizedCoords(e);
    setHoverCoords(coords);

    if (!dragState) return;

    if (dragState.type === 'vp') {
      onUpdateVanishingPoint(dragState.id, { x: coords.x, y: coords.y });
    } else if (dragState.type === 'horizon') {
      onUpdateGuides({ horizonY: coords.y });
    } else if (dragState.type === 'split-wipe') {
      onUpdateShader({ splitPosition: Math.round(coords.x) });
    } else if (dragState.type === 'move-panel') {
      const dx = coords.x - dragState.startX;
      const dy = coords.y - dragState.startY;
      const ann = annotations.find((a) => a.id === dragState.id);
      const w = ann ? ann.width : 10;
      const h = ann ? ann.height : 10;
      const nextX = Math.max(0, Math.min(100 - w, dragState.origX + dx));
      const nextY = Math.max(0, Math.min(100 - h, dragState.origY + dy));
      onUpdateAnnotation(dragState.id, {
        x: Number(nextX.toFixed(1)),
        y: Number(nextY.toFixed(1)),
      });
    } else if (dragState.type === 'resize-panel') {
      const dw = coords.x - dragState.startX;
      const dh = coords.y - dragState.startY;
      const ann = annotations.find((a) => a.id === dragState.id);
      const maxW = ann ? 100 - ann.x : 100;
      const maxH = ann ? 100 - ann.y : 100;
      const nextW = Math.max(4, Math.min(maxW, dragState.origW + dw));
      const nextH = Math.max(4, Math.min(maxH, dragState.origH + dh));
      onUpdateAnnotation(dragState.id, {
        width: Number(nextW.toFixed(1)),
        height: Number(nextH.toFixed(1)),
      });
    } else if (dragState.type === 'draw-new-panel') {
      setDragState({
        ...dragState,
        currX: coords.x,
        currY: coords.y,
      });
    }
  };

  const handleSvgMouseUp = () => {
    if (dragState?.type === 'draw-new-panel') {
      const x = Math.min(dragState.startX, dragState.currX);
      const y = Math.min(dragState.startY, dragState.currY);
      const width = Math.abs(dragState.currX - dragState.startX);
      const height = Math.abs(dragState.currY - dragState.startY);
      if (width >= 3 && height >= 3) {
        onCreateAnnotation({
          x: Number(x.toFixed(1)),
          y: Number(y.toFixed(1)),
          width: Number(width.toFixed(1)),
          height: Number(height.toFixed(1)),
        });
      }
      onToolModeChange('select');
    }
    setDragState(null);
  };

  // Composite export of WebGL shader + SVG vector overlays + archival footer plate
  const handleExportCompositePNG = useCallback(() => {
    const webglCanvas = canvasRef.current;
    const svgElement = svgRef.current;
    if (!webglCanvas || !svgElement) return;

    // Ensure WebGL buffer is freshly drawn
    renderWebGL();

    const w = webglCanvas.width;
    const h = webglCanvas.height;
    const footerHeight = Math.max(64, Math.round(h * 0.075));

    const outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h + footerHeight;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) return;

    // 1. Fill archival paper background
    ctx.fillStyle = '#FBF9F5';
    ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);

    // 2. Draw WebGL canvas
    ctx.drawImage(webglCanvas, 0, 0, w, h);

    // 3. Serialize SVG overlay and draw over canvas
    const finishDownload = () => {
      // Draw editorial caption strip at bottom
      ctx.fillStyle = '#FBF9F5';
      ctx.fillRect(0, h, w, footerHeight);
      ctx.strokeStyle = '#D6CEBE';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(w, h);
      ctx.stroke();

      const fontSizeTitle = Math.max(16, Math.round(footerHeight * 0.34));
      const fontSizeMeta = Math.max(12, Math.round(footerHeight * 0.22));
      ctx.fillStyle = '#1C1917';
      ctx.font = `600 ${fontSizeTitle}px Georgia, serif`;
      ctx.fillText(
        `${title} — ${creatorCredit}`,
        Math.round(w * 0.025),
        h + Math.round(footerHeight * 0.48)
      );

      ctx.fillStyle = '#57534E';
      ctx.font = `500 ${fontSizeMeta}px monospace`;
      ctx.fillText(
        `${accessionNumber} · SHADER: ${shaderConfig.mode.toUpperCase()} · PANELS/SHOTS: ${annotations.length} · MISE & GUTTER ARCHIVE`,
        Math.round(w * 0.025),
        h + Math.round(footerHeight * 0.8)
      );

      const link = document.createElement('a');
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      link.download = `mise-gutter-${slug || 'study'}.png`;
      link.href = outCanvas.toDataURL('image/png');
      link.click();
    };

    if (!showAllOverlays) {
      finishDownload();
      return;
    }

    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
    clonedSvg.setAttribute('width', String(w));
    clonedSvg.setAttribute('height', String(h));
    const svgString = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgString], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const url = URL.createObjectURL(svgBlob);
    const svgImg = new Image();
    svgImg.onload = () => {
      ctx.drawImage(svgImg, 0, 0, w, h);
      URL.revokeObjectURL(url);
      finishDownload();
    };
    svgImg.onerror = () => {
      URL.revokeObjectURL(url);
      finishDownload();
    };
    svgImg.src = url;
  }, [
    renderWebGL,
    title,
    creatorCredit,
    accessionNumber,
    shaderConfig.mode,
    annotations.length,
    showAllOverlays,
  ]);

  useEffect(() => {
    if (exportTriggerRef) {
      exportTriggerRef.current = handleExportCompositePNG;
    }
  }, [exportTriggerRef, handleExportCompositePNG]);

  // Compute Golden Spiral SVG transform based on orientation (0, 90, 180, 270)
  const getSpiralTransform = () => {
    switch (guidesConfig.spiralOrientation) {
      case 90:
        return 'translate(1000, 0) scale(-1, 1)';
      case 180:
        return 'translate(1000, 1000) scale(-1, -1)';
      case 270:
        return 'translate(0, 1000) scale(1, -1)';
      default:
        return undefined;
    }
  };

  const sortedAnnotations = [...annotations].sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col h-full bg-[#F2ECE1] border-r border-[#D6CEBE] select-none">
      {/* Stage Top Instrument Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#FBF9F5] border-b border-[#D6CEBE]">
        {/* Interactive Stage Cursor Modes */}
        <div className="flex items-center gap-1 p-1 bg-[#EBE6DF] rounded-md border border-[#D6CEBE]">
          <button
            type="button"
            onClick={() => onToolModeChange('select')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              toolMode === 'select'
                ? 'bg-[#FBF9F5] text-[#1C1917] shadow-xs border border-[#D6CEBE]'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>Select &amp; Drag</span>
          </button>

          <button
            type="button"
            onClick={() => onToolModeChange('draw-panel')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              toolMode === 'draw-panel'
                ? 'bg-[#9A3412] text-[#FBF9F5] shadow-xs'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <SquarePlus className="w-3.5 h-3.5" />
            <span>Draw Panel / Shot Box</span>
          </button>

          <button
            type="button"
            onClick={() => onToolModeChange('place-vp')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              toolMode === 'place-vp'
                ? 'bg-[#1E3A8A] text-[#FBF9F5] shadow-xs'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Place Vanishing Point</span>
          </button>
        </div>

        {/* Quick Armature Toggles & Split Compare */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              onUpdateShader({
                splitPosition: shaderConfig.splitPosition > 0 ? 0 : 50,
              })
            }
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 ${
              shaderConfig.splitPosition > 0
                ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917]'
                : 'bg-[#FBF9F5] text-[#57534E] border-[#D6CEBE] hover:text-[#1C1917]'
            }`}
            title="Compare Original vs Active WebGL Shader"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Split Wipe</span>
          </button>

          {guidesConfig.goldenSpiral && (
            <button
              type="button"
              onClick={() =>
                onUpdateGuides({
                  spiralOrientation: (((guidesConfig.spiralOrientation + 90) %
                    360) as 0 | 90 | 180 | 270),
                })
              }
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-[#FBF9F5] text-[#57534E] hover:text-[#1C1917] border border-[#D6CEBE] rounded transition-colors whitespace-nowrap shrink-0"
              title="Flip / Rotate Fibonacci Golden Spiral"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Spiral {guidesConfig.spiralOrientation}°</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAllOverlays((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-[#FBF9F5] text-[#57534E] hover:text-[#1C1917] border border-[#D6CEBE] rounded transition-colors whitespace-nowrap shrink-0"
          >
            {showAllOverlays ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Guides On</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Guides Hidden</span>
              </>
            )}
          </button>

          <div className="flex items-center border border-[#D6CEBE] rounded bg-[#FBF9F5]">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
              className="p-1.5 text-[#57534E] hover:text-[#1C1917]"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-xs font-mono tabular-nums text-[#1C1917]">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.0, +(z + 0.15).toFixed(2)))}
              className="p-1.5 text-[#57534E] hover:text-[#1C1917]"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="p-1.5 text-[#57534E] hover:text-[#1C1917] border-l border-[#D6CEBE]"
              title="Reset Zoom"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportCompositePNG}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1C1917] text-[#FBF9F5] hover:bg-[#292524] rounded transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Plate PNG</span>
          </button>
        </div>
      </div>

      {/* Main Drafting Viewport */}
      <div
        ref={stageContainerRef}
        className="relative flex-1 overflow-auto drafting-grid-bg flex items-center justify-center p-6 lg:p-8"
      >
        {/* Contextual Mode Banner when drawing panels or placing VP */}
        {toolMode !== 'select' && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 bg-[#1C1917] text-[#FBF9F5] text-xs font-medium rounded shadow-sm flex items-center gap-3">
            <span>
              {toolMode === 'draw-panel'
                ? 'Click and drag across the plate to draw a new Panel / Shot Bounding Box'
                : 'Click anywhere on the plate to anchor a new Perspective Vanishing Point'}
            </span>
            <button
              type="button"
              onClick={() => onToolModeChange('select')}
              className="underline text-[#D6CEBE] hover:text-white"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Framed Artwork & Synchronized WebGL + SVG Stack */}
        <div
          className="relative bg-[#FBF9F5] p-3 border border-[#D6CEBE] shadow-sm transition-transform duration-150"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        >
          <div
            className="relative overflow-hidden bg-[#1C1917]"
            style={{
              width:
                imageSize.width > imageSize.height
                  ? 'min(74vw, 880px)'
                  : 'min(52vw, 560px)',
              aspectRatio: `${imageSize.width} / ${imageSize.height}`,
            }}
          >
            {/* Fallback container if image fails */}
            {imageError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#EBE6DF] text-[#1C1917] p-8 text-center">
                <p className="font-serif text-lg">
                  Archival Plate Preview Unavailable
                </p>
                <p className="text-xs text-[#57534E] mt-1">
                  {title} · {accessionNumber}
                </p>
              </div>
            )}

            {/* Layer 1: Hardware-Accelerated WebGL Fragment Shader Canvas */}
            <canvas
              ref={canvasRef}
              className="w-full h-full block object-contain"
            />

            {/* Layer 2: Synchronized Interactive Vector SVG Overlay */}
            <svg
              ref={svgRef}
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
              onMouseDown={handleSvgMouseDown}
              onMouseMove={handleSvgMouseMove}
              onMouseUp={handleSvgMouseUp}
              onMouseLeave={() => {
                setHoverCoords(null);
                if (dragState) handleSvgMouseUp();
              }}
              className={`absolute inset-0 w-full h-full ${
                toolMode === 'draw-panel' || toolMode === 'place-vp'
                  ? 'cursor-crosshair'
                  : 'cursor-default'
              }`}
              style={{ opacity: showAllOverlays ? guidesConfig.guideOpacity : 0 }}
            >
              <defs>
                {/* Arrowhead marker for Scott McCloud Gutter Reading Vectors */}
                <marker
                  id="gutter-arrow"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#9A3412" />
                </marker>
              </defs>

              {/* 1. Dynamic Symmetry (Baroque & Sinister Diagonals + Reciprocals) */}
              {guidesConfig.dynamicSymmetry && (
                <g
                  stroke={guidesConfig.primaryGuideColor}
                  strokeWidth="1.5"
                  opacity="0.72"
                >
                  {/* Baroque diagonal (Bottom-Left to Top-Right) */}
                  <line x1="0" y1="1000" x2="1000" y2="0" />
                  {/* Sinister diagonal (Top-Left to Bottom-Right) */}
                  <line
                    x1="0"
                    y1="0"
                    x2="1000"
                    y2="1000"
                    strokeDasharray="8 6"
                  />
                  {/* Reciprocal diagonals from corners */}
                  <line
                    x1="0"
                    y1="0"
                    x2="618"
                    y2="1000"
                    strokeWidth="1"
                    opacity="0.55"
                  />
                  <line
                    x1="1000"
                    y1="0"
                    x2="382"
                    y2="1000"
                    strokeWidth="1"
                    opacity="0.55"
                  />
                  <line
                    x1="0"
                    y1="1000"
                    x2="618"
                    y2="0"
                    strokeWidth="1"
                    opacity="0.55"
                  />
                  <line
                    x1="1000"
                    y1="1000"
                    x2="382"
                    y2="0"
                    strokeWidth="1"
                    opacity="0.55"
                  />
                </g>
              )}

              {/* 2. Rule of Thirds Grid + Power-Point Reticles */}
              {guidesConfig.ruleOfThirds && (
                <g stroke={guidesConfig.primaryGuideColor} strokeWidth="1.6">
                  <line x1="333.3" y1="0" x2="333.3" y2="1000" />
                  <line x1="666.7" y1="0" x2="666.7" y2="1000" />
                  <line x1="0" y1="333.3" x2="1000" y2="333.3" />
                  <line x1="0" y1="666.7" x2="1000" y2="666.7" />
                  {[333.3, 666.7].map((cx) =>
                    [333.3, 666.7].map((cy) => (
                      <circle
                        key={`${cx}-${cy}`}
                        cx={cx}
                        cy={cy}
                        r="8"
                        fill="none"
                        stroke={guidesConfig.primaryGuideColor}
                        strokeWidth="2"
                      />
                    ))
                  )}
                </g>
              )}

              {/* 3. Fibonacci Golden Spiral + Golden Ratio Subdivision Armature */}
              {guidesConfig.goldenSpiral && (
                <g
                  transform={getSpiralTransform()}
                  stroke={guidesConfig.primaryGuideColor}
                  fill="none"
                >
                  {/* Golden Subdivision lines */}
                  <line
                    x1="618"
                    y1="0"
                    x2="618"
                    y2="1000"
                    strokeWidth="1.4"
                    strokeDasharray="5 5"
                  />
                  <line
                    x1="618"
                    y1="618"
                    x2="1000"
                    y2="618"
                    strokeWidth="1.4"
                    strokeDasharray="5 5"
                  />
                  <line
                    x1="764"
                    y1="618"
                    x2="764"
                    y2="1000"
                    strokeWidth="1.4"
                    strokeDasharray="5 5"
                  />
                  <line
                    x1="618"
                    y1="764"
                    x2="764"
                    y2="764"
                    strokeWidth="1.4"
                    strokeDasharray="5 5"
                  />
                  {/* Logarithmic Fibonacci Spiral Curve */}
                  <path
                    d="M 0 1000 A 618 618 0 0 1 618 0 A 382 382 0 0 1 1000 618 A 236 236 0 0 1 764 1000 A 146 146 0 0 1 618 764 A 90 90 0 0 1 708 618 A 56 56 0 0 1 764 708"
                    strokeWidth="3"
                  />
                  <circle
                    cx="726"
                    cy="685"
                    r="10"
                    fill={guidesConfig.primaryGuideColor}
                    opacity="0.85"
                  />
                </g>
              )}

              {/* 4. Center Crosshair */}
              {guidesConfig.centerCrosshair && (
                <g
                  stroke={guidesConfig.primaryGuideColor}
                  strokeWidth="1.4"
                  opacity="0.75"
                >
                  <line
                    x1="500"
                    y1="0"
                    x2="500"
                    y2="1000"
                    strokeDasharray="4 6"
                  />
                  <line
                    x1="0"
                    y1="500"
                    x2="1000"
                    y2="500"
                    strokeDasharray="4 6"
                  />
                  <circle cx="500" cy="500" r="14" fill="none" />
                </g>
              )}

              {/* 5. Interactive Horizon Line */}
              {guidesConfig.horizonLine && (
                <g>
                  <line
                    x1="0"
                    y1={guidesConfig.horizonY * 10}
                    x2="1000"
                    y2={guidesConfig.horizonY * 10}
                    stroke="#1E3A8A"
                    strokeWidth="2.5"
                    strokeDasharray="12 6"
                  />
                  <g
                    className="cursor-ns-resize"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDragState({ type: 'horizon' });
                    }}
                  >
                    <rect
                      x="12"
                      y={guidesConfig.horizonY * 10 - 14}
                      width="155"
                      height="28"
                      rx="3"
                      fill="#1E3A8A"
                    />
                    <text
                      x="22"
                      y={guidesConfig.horizonY * 10 + 5}
                      fill="#FBF9F5"
                      fontSize="16"
                      fontFamily="monospace"
                      fontWeight="600"
                    >
                      HORIZON {guidesConfig.horizonY.toFixed(1)}%
                    </text>
                  </g>
                </g>
              )}

              {/* 6. Perspective Vanishing Points & Radiating Convergence Rays */}
              {guidesConfig.vanishingPoints
                .filter((vp) => vp.enabled)
                .map((vp) => {
                  const cx = vp.x * 10;
                  const cy = vp.y * 10;
                  const rays = [];
                  for (let i = 0; i < vp.rayCount; i++) {
                    const angle = (i / vp.rayCount) * Math.PI * 2;
                    const tx = cx + Math.cos(angle) * 1600;
                    const ty = cy + Math.sin(angle) * 1600;
                    rays.push(
                      <line
                        key={i}
                        x1={cx}
                        y1={cy}
                        x2={tx}
                        y2={ty}
                        stroke={vp.color}
                        strokeWidth="1.5"
                        strokeDasharray="8 6"
                        opacity="0.72"
                      />
                    );
                  }
                  return (
                    <g key={vp.id}>
                      {rays}
                      {/* Interactive Draggable Vanishing Point Hub */}
                      <g
                        className="cursor-move"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setDragState({ type: 'vp', id: vp.id });
                        }}
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r="22"
                          fill={vp.color}
                          fillOpacity="0.2"
                          stroke={vp.color}
                          strokeWidth="2.5"
                        />
                        <circle cx={cx} cy={cy} r="6" fill={vp.color} />
                        <rect
                          x={Math.min(780, cx + 14)}
                          y={Math.max(10, cy - 32)}
                          width="205"
                          height="28"
                          rx="3"
                          fill="#1C1917"
                        />
                        <text
                          x={Math.min(780, cx + 14) + 10}
                          y={Math.max(10, cy - 32) + 19}
                          fill="#FBF9F5"
                          fontSize="15"
                          fontFamily="monospace"
                          fontWeight="600"
                        >
                          {vp.label.split('·')[0].trim()} ({vp.x.toFixed(0)}%,
                          {vp.y.toFixed(0)}%)
                        </text>
                      </g>
                    </g>
                  );
                })}

              {/* 7. Panel Bounding Boxes & Shot Regions */}
              {guidesConfig.showPanelBoxes &&
                sortedAnnotations.map((ann) => {
                  const isSelected = ann.id === selectedAnnotationId;
                  const bx = ann.x * 10;
                  const by = ann.y * 10;
                  const bw = ann.width * 10;
                  const bh = ann.height * 10;
                  const mcMeta = MCCLOUD_TRANSITION_META[ann.transitionType];
                  const shotMeta = CINEMA_SHOT_META[ann.shotType];

                  return (
                    <g key={ann.id}>
                      {/* Bounding Box Frame */}
                      <rect
                        x={bx}
                        y={by}
                        width={bw}
                        height={bh}
                        fill={ann.color}
                        fillOpacity={isSelected ? '0.16' : '0.06'}
                        stroke={isSelected ? '#FBF9F5' : ann.color}
                        strokeWidth={isSelected ? '4' : '2.5'}
                        className="cursor-move"
                        onMouseDown={(e) => {
                          if (toolMode !== 'select') return;
                          e.stopPropagation();
                          onSelectAnnotation(ann.id);
                          const coords = getNormalizedCoords(e);
                          setDragState({
                            type: 'move-panel',
                            id: ann.id,
                            startX: coords.x,
                            startY: coords.y,
                            origX: ann.x,
                            origY: ann.y,
                          });
                        }}
                      />
                      {isSelected && (
                        <rect
                          x={bx}
                          y={by}
                          width={bw}
                          height={bh}
                          fill="none"
                          stroke={ann.color}
                          strokeWidth="2.5"
                          strokeDasharray="8 5"
                          pointerEvents="none"
                        />
                      )}

                      {/* Top-Left Editorial Sequence & Taxonomy Label Plate */}
                      <g
                        className="cursor-pointer"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          onSelectAnnotation(ann.id);
                        }}
                      >
                        <rect
                          x={bx}
                          y={Math.max(0, by)}
                          width={Math.min(bw, 260)}
                          height="32"
                          fill={ann.color}
                        />
                        <text
                          x={bx + 10}
                          y={Math.max(0, by) + 21}
                          fill="#FBF9F5"
                          fontSize="16"
                          fontFamily="monospace"
                          fontWeight="700"
                        >
                          #{String(ann.order).padStart(2, '0')} · {mcMeta.code} ·{' '}
                          {shotMeta.code}
                        </text>
                      </g>

                      {/* Bottom-Right Resize Handle when selected */}
                      {isSelected && toolMode === 'select' && (
                        <rect
                          x={bx + bw - 16}
                          y={by + bh - 16}
                          width="16"
                          height="16"
                          fill="#FBF9F5"
                          stroke={ann.color}
                          strokeWidth="3"
                          className="cursor-nwse-resize"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            const coords = getNormalizedCoords(e);
                            setDragState({
                              type: 'resize-panel',
                              id: ann.id,
                              startX: coords.x,
                              startY: coords.y,
                              origW: ann.width,
                              origH: ann.height,
                            });
                          }}
                        />
                      )}
                    </g>
                  );
                })}

              {/* 8. Scott McCloud Sequential Gutter Reading Flow Vectors (1 -> 2 -> 3) */}
              {guidesConfig.showPanelBoxes &&
                guidesConfig.showGutterFlow &&
                sortedAnnotations.length > 1 &&
                sortedAnnotations.slice(0, -1).map((curr, idx) => {
                  const next = sortedAnnotations[idx + 1];
                  const x1 = (curr.x + curr.width / 2) * 10;
                  const y1 = (curr.y + curr.height / 2) * 10;
                  const x2 = (next.x + next.width / 2) * 10;
                  const y2 = (next.y + next.height / 2) * 10;
                  const midX = (x1 + x2) / 2;
                  const midY = (y1 + y2) / 2;
                  const nextMcMeta =
                    MCCLOUD_TRANSITION_META[next.transitionType];

                  return (
                    <g key={`flow-${curr.id}-${next.id}`} pointerEvents="none">
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#FBF9F5"
                        strokeWidth="6"
                        opacity="0.85"
                      />
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#9A3412"
                        strokeWidth="3"
                        strokeDasharray="10 6"
                        markerEnd="url(#gutter-arrow)"
                      />
                      {/* Gutter Transition Callout Tag at Midpoint */}
                      <rect
                        x={midX - 54}
                        y={midY - 15}
                        width="108"
                        height="30"
                        rx="4"
                        fill="#1C1917"
                        stroke="#FBF9F5"
                        strokeWidth="2"
                      />
                      <text
                        x={midX}
                        y={midY + 5}
                        textAnchor="middle"
                        fill="#FBF9F5"
                        fontSize="15"
                        fontFamily="monospace"
                        fontWeight="700"
                      >
                        {curr.order}→{next.order} {nextMcMeta.code}
                      </text>
                    </g>
                  );
                })}

              {/* 9. Live Preview Box while Drawing a New Panel / Shot Region */}
              {dragState?.type === 'draw-new-panel' && (
                <rect
                  x={Math.min(dragState.startX, dragState.currX) * 10}
                  y={Math.min(dragState.startY, dragState.currY) * 10}
                  width={Math.abs(dragState.currX - dragState.startX) * 10}
                  height={Math.abs(dragState.currY - dragState.startY) * 10}
                  fill="#9A3412"
                  fillOpacity="0.2"
                  stroke="#9A3412"
                  strokeWidth="3"
                  strokeDasharray="8 5"
                />
              )}

              {/* 10. Split-Screen Shader Comparison Wipe Handle */}
              {shaderConfig.splitPosition > 0 && (
                <g
                  className="cursor-ew-resize"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDragState({ type: 'split-wipe' });
                  }}
                >
                  <line
                    x1={shaderConfig.splitPosition * 10}
                    y1="0"
                    x2={shaderConfig.splitPosition * 10}
                    y2="1000"
                    stroke="#FBF9F5"
                    strokeWidth="4"
                  />
                  <circle
                    cx={shaderConfig.splitPosition * 10}
                    cy="500"
                    r="20"
                    fill="#1C1917"
                    stroke="#FBF9F5"
                    strokeWidth="3"
                  />
                  <text
                    x={shaderConfig.splitPosition * 10}
                    y="506"
                    textAnchor="middle"
                    fill="#FBF9F5"
                    fontSize="16"
                    fontFamily="monospace"
                    fontWeight="700"
                  >
                    ⇄
                  </text>
                </g>
              )}
            </svg>
          </div>

          {/* Museum Figure Caption Bar directly beneath the plate */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 px-1 text-xs text-[#57534E] border-t border-[#EBE6DF] mt-2">
            <div className="flex items-center gap-2 font-serif italic text-[#1C1917]">
              <span>Fig. {accessionNumber} —</span>
              <span className="font-semibold not-italic">{title}</span>
              <span aria-hidden="true">·</span>
              <span className="not-italic text-[#57534E]">{creatorCredit}</span>
            </div>

            <div className="flex items-center gap-2 font-mono tabular-nums text-[11px]">
              <span>
                RES: {imageSize.width}×{imageSize.height}px
              </span>
              <span aria-hidden="true">·</span>
              <span>SHADER: {shaderConfig.mode.toUpperCase()}</span>
              {hoverCoords && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#9A3412] font-medium">
                    X: {hoverCoords.x.toFixed(1)}% Y: {hoverCoords.y.toFixed(1)}%
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Calibrated IRE False-Color Exposure Legend Bar (visible when Luminance Heatmap is active) */}
      {shaderConfig.mode === 'luminance' && (
        <div className="px-5 py-2 bg-[#1C1917] text-[#FBF9F5] flex flex-wrap items-center justify-between gap-4 text-xs">
          <span className="font-mono uppercase tracking-wider text-[#D6CEBE]">
            IRE False-Color Exposure Scale
          </span>
          <div className="flex items-center gap-4 font-mono text-[11px] tabular-nums">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 inline-block bg-[#1C245C] border border-white/30" />
              0–20 IRE Deep Shadow
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 inline-block bg-[#1473AD] border border-white/30" />
              25–45 IRE Low Mid
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 inline-block bg-[#299E6B] border border-white/30" />
              45–60 IRE Key Midtone
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 inline-block bg-[#EBA31F] border border-white/30" />
              65–85 IRE High Key
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 inline-block bg-[#C7291F] border border-white/30" />
              85–100 IRE Peak Clip
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
