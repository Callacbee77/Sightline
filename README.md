# Sightline

**An interactive, WebGL-powered composition and visual storytelling analyzer for film stills and comic art.**

Sightline is a browser-based study tool designed for filmmakers, comic artists, and visual analysts. Upload any film frame or comic page to overlay dynamic geometric guides, inspect real-time luminance and edge-detection shaders, and annotate shot types or panel transitions.

---

## Features

* **Dynamic Composition Overlays:** Toggle and customize Rule of Thirds, Golden Ratio / Fibonacci Spiral, Diagonal Method, and Center Crosshair guides.
* **Perspective & Vanishing Points:** Place interactive horizon lines and multi-point perspective grids directly over scenes to study spatial depth.
* **Real-Time WebGL Shaders:**
  * **Luminance Heatmap:** Visualize value distribution and focal contrast.
  * **Sobel Edge Detection:** Strip away color and texture to isolate pure linework and silhouettes.
  * **Grayscale / Value Study:** Flatten hues to evaluate lighting balance.
* **Shot & Panel Annotation:** Tag frames with standard cinematography metadata (e.g., *Extreme Close-Up*, *Dutch Angle*, *Establishing Shot*) or comic panel transitions (*Moment-to-Moment*, *Action-to-Action*, *Aspect-to-Aspect*).
* **Export:** Save annotated frames with active overlays and shader passes as PNGs for study decks or critiques.

---

## Tech Stack

* **Runtime / Server:** Node.js, Express
* **Graphics & Rendering:** WebGL2 (GLSL fragment shaders), HTML5 Canvas API
* **Frontend:** Vanilla JavaScript (ES6+), CSS3

---

## Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) (v18 or higher)
* npm (included with Node.js)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/sightline.git
   cd sightline
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`.

---

## Project Structure

```text
sightline/
├── public/
│   ├── index.html          # Main application shell
│   ├── styles.css          # UI and canvas layout styles
│   ├── js/
│   │   ├── main.js         # App initialization & state management
│   │   ├── overlays.js     # 2D Canvas composition & perspective guides
│   │   └── webgl.js        # WebGL2 context & texture pipeline
│   └── shaders/
│       ├── passthrough.vert
│       ├── luminance.frag  # Value & contrast heatmap shader
│       └── sobel.frag      # Edge-detection shader
├── server.js               # Express static & upload server
├── package.json
└── README.md
```

---

## Roadmap

- [ ] Support for multi-frame sequence comparison (side-by-side storyboard/shot-reverse-shot analysis).
- [ ] Custom JSON export/import for saving annotation sessions.
- [ ] Keyboard shortcuts for rapid guide cycling and shader toggling.
- [ ] Video frame-scrubbing support for short `.mp4` / `.webm` clips.

---

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
