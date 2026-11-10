# ARCANUM — Milestone 01

A dark-fantasy ancient history encyclopedia built with HTML, CSS, JavaScript and Three.js.

## Requirements
- Visual Studio Code
- A modern browser with WebGL support
- Internet connection (Three.js, Google Fonts and remote card photography load from CDNs)

## Run locally
1. Extract the `ARCANUM` folder.
2. Open the folder in Visual Studio Code.
3. Install the **Live Server** extension (by Ritwick Dey).
4. Right-click `index.html`.
5. Choose **Open with Live Server**.

Do not open `index.html` by double-clicking it. ES modules are best served through a local development server.

## What is included
- Cinematic landing page and responsive navigation
- Procedural Three.js golden artifact (no model download required)
- Mouse-responsive artifact rotation and camera movement
- Floating dust particles, lighting and fog
- Civilization cards and historical timeline
- Modular JavaScript structure prepared for later GLB models

## Important notes
- The artifact is an original procedural decorative design, not a verified historical object.
- Historical dates are approximate and intentionally qualified where appropriate.
- Card photographs are loaded from Unsplash URLs and require internet access.
- Three.js is loaded from jsDelivr via an import map.

## Troubleshooting
**Blank 3D area:** Update your browser and check that hardware acceleration/WebGL is enabled. Open DevTools (F12) → Console to inspect errors.

**Module/import errors:** Make sure Live Server is running from the project folder and that the import map appears before `main.js`.

**Images do not load:** Check your internet connection. The rest of the page should still work.

## Next milestone
Milestone 02 will add individual civilization pages, historical article views, archive search and real licensed GLB artifact models.

## Milestone 01 — The Medieval Scholar's Study
- Replaced the near-black futuristic look with a warm scholar's study atmosphere: walnut tones, aged parchment, antique brass, burgundy accents and serif typography.
- Added a decorative antique atlas plate behind the hero instrument and a study shelf of historically inspired instruments.
- Replaced the abstract golden centerpiece with a procedural, historically inspired brass astrolabe (الأسطرلاب). It remains pointer-responsive and needs no external model file.
- Preserved the four civilization cards, expanded archive descriptions, archive morph/zoom transition, procedural 3D landmark scenes, landmark rotation controls, chronicles and timeline.
- The antique atlas shown in this milestone is a decorative visual plate. The draggable / zoomable historical map and clickable region markers remain planned for Milestone 02.

## Run locally
1. Extract the ZIP.
2. Open the `ARCANUM` folder in Visual Studio Code.
3. Right-click `index.html` and choose **Open with Live Server**.
4. Keep an internet connection active for the Three.js CDN, Google Fonts and archive card photography.


## Milestone 02 — Complete experience switcher
The header now includes a **Change Experience** control. It switches the website's complete layout, not only its color palette:

- **Scholar's Study** — the original walnut study, instruments, manuscript-inspired archive cards and editorial timeline.
- **Explorer's Atlas** — a map-led entrance, field-note index, horizontal archive records and expedition-style chronology.
- **Grand Museum** — a brighter exhibition hall, centered instrument displays, framed collection galleries and exhibit-style timeline.

The selected experience is saved in the browser and restored on the next visit. The switcher supports keyboard operation and adapts to mobile screens. All three experiences share the same civilization data, expanded archive descriptions, archive transitions and Three.js landmark models. The archive viewer also receives layout-specific presentation styling.

## Experience morph transition
- Selecting a different experience now launches a full-screen antique seal morph from the selected menu option.
- The seal expands to cover the current page, the destination layout is applied underneath it, and the seal contracts to reveal the new structure.
- The destination experience is saved after the transition begins; selecting the already-active experience closes the menu without replaying the animation.
- Users who enable **Reduce motion** get an immediate experience switch instead of the full-screen animation.
