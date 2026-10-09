# InkNote Studio

An offline notebook for Windows. Open a PDF or start from blank pages, write by hand with a pen or mouse, and lay out pages the way you would in Canva: text in your own fonts, saved text styles, images, shapes and stickers you can drag anywhere.

No account, no subscription, no cloud. Notebooks are plain `.inknote` files on your PC.

## Download

Installers are built by GitHub Actions on every push (**Actions → Build Windows app → Artifacts**). Tagged versions (`v*`) are published under **Releases**.

| File | Use |
|---|---|
| `InkNote Studio-Setup-<version>.exe` | Installer. Lets you pick the install folder and adds Start menu and desktop shortcuts. `.inknote` files open with the app. |
| `InkNote Studio-Portable-<version>.exe` | Single exe that runs without installing, for example from a USB stick. |

The builds aren't code-signed, so Windows SmartScreen may warn the first time. Choose **More info → Run anyway**.

## What it does

**Notebooks and pages**
- Start from ruled, narrow-ruled, grid, dot grid, isometric, Cornell, music staff or checklist paper. Choose the size (A3, A4, A5, Letter, Legal, 16:9, square), orientation, paper colour and line spacing.
- Open a PDF and write on it. Pages are rendered sharply at every zoom level.
- Insert pages from more PDFs, or turn scans and photos into pages.
- The page sidebar shows thumbnails. Drag to reorder, Ctrl or Shift-click to select several pages, hover between two pages to insert one there, and right-click for the full page menu: add before or after, duplicate, delete, change template, rotate, bookmark, rename, export.
- The Outline tab lists bookmarks, headings imported from the PDF, and your own entries. These become bookmarks in exported PDFs.
- Search (Ctrl+F) looks through typed text and the text of imported PDFs.

**Handwriting and annotation**
- Fountain, ballpoint, brush and pencil pens with real stylus pressure. Mouse users get simulated pressure from drawing speed.
- Pen settings: thickness, opacity, pressure sensitivity, smoothing, a stabiliser that reduces hand shake, and start and end taper. You can save pen presets and replace the toolbar swatches with your own colours.
- Draw a stroke and hold at the end to snap it to a line, rectangle, ellipse or triangle. Hold Shift for a straight line.
- The highlighter draws behind your handwriting and straightens strokes that are nearly straight. On PDF pages it snaps to the text lines it covers, as a highlight, underline or strikethrough.
- The eraser removes whole strokes or only the part it touches. It can be limited to pen or highlighter only, and can switch back to your previous tool afterwards. Scribbling back and forth over handwriting erases it.
- Stylus hardware: the eraser end always erases, and the barrel button lassoes.
- The lasso selects by freehand loop and can be limited to handwriting, text, images or shapes. A selection can be recoloured, resized, duplicated, saved as an image, added to Elements, or moved to another page.
- Study tape hides answers until you click it. The laser pointer and presentation mode (F5) are for showing your notes.

**Design like Canva**
- Text boxes use any font installed on Windows. You can set size, colour, bold, italic, underline, strikethrough, alignment, bullets or numbering, letter and line spacing, case, shadow, outline, highlight and box background.
- Saved text styles: Title, Heading, Subheading, Body, Caption, Quote, Handwritten, and any style you save from your own text. Click to apply, or drag a style from the toolbar onto the page.
- Arabic and Hebrew text switches the box to right-to-left automatically.
- Moving objects shows magenta guides that snap to page edges, page centres and other objects, with distance labels. Hold Ctrl while dragging to turn snapping off.
- Alt+drag duplicates, Shift constrains, and the arrow keys nudge.
- A floating toolbar above the selection holds the right controls for text, images, shapes or ink.
- Position panel: align, distribute, layer order, exact X/Y/W/H/rotation/opacity, and a layers list.
- Images: insert, paste or drag in from Explorer. You can crop (double-click), flip, rotate, round the corners, add a border or shadow, adjust brightness, contrast, saturation and blur, apply black-and-white or sepia, and replace the image.
- Shapes: rectangle, rounded rectangle, ellipse, triangle, diamond, star, line and arrow, with fill and outline settings.
- Sticky notes, links to pages or websites, and reusable Elements: saved selections, stamps and signatures.
- Group, lock, copy style and paste style.

**Audio synced to notes**
- Record a lecture while you write. Every stroke and text box remembers the moment it was made.
- Select any note and press play to hear what was said at that moment.
- Replay dims notes that were written after the playhead.

**Saving and export**
- Saving writes one `.inknote` file. It's an open ZIP of JSON plus your original PDFs, images and audio.
- Unsaved work is mirrored every minute for crash recovery. Files that have already been saved are autosaved.
- Export to PDF keeps imported PDF pages as the original vectors and adds your annotations on top. Typed text stays searchable and selectable, bookmarks and links are kept, and file sizes stay small.
- Export a page as PNG, or print.

Undo and redo (Ctrl+Z / Ctrl+Y) step through one action at a time, including page operations. Light, dark and system themes are available, and dark paper can be turned on while you work.

Press **Ctrl+/** in the app for the full keyboard shortcut list.

## Build from source

Requirements: Node.js 20 or later.

```bash
npm install          # also copies the renderer libraries into src/renderer/vendor
npm start            # run the app
npm run check        # syntax-check all sources
npm test             # end-to-end smoke test (Playwright + Electron)
npm run dist         # build dist/InkNote Studio-Setup-<v>.exe and the portable exe
```

`npm run dist` builds natively on Windows. On Linux or macOS it needs Wine for the NSIS step. The exe icon and version info are written by `build/afterPack.cjs` using a pure-JS resource editor, so `rcedit` isn't needed.

## Project layout

```
src/main/            Electron main process (window, dialogs, fonts, settings, recovery) and preload bridge
src/renderer/        UI (no bundler; ES modules served from the app:// protocol)
  js/editor.js       document model, per-page Fabric canvases (virtualised), undo/redo, zoom
  js/tools.js        pen/highlighter/eraser/lasso/shapes/text/tape/laser, smart guides
  js/ink.js          perfect-freehand strokes, shape recognition, partial erase
  js/pdf.js          PDF.js rendering and pdf-lib export
  js/doc.js          .inknote format, paper templates
  js/selbar.js       floating selection toolbar
  js/sidebar.js      page thumbnails and outline
  js/panels.js       position, text styles, effects, image adjust, search, annotations, elements
build/               icon and packaging hook
docs/research/       the competitor and UX research behind the feature set
tests/smoke.mjs      end-to-end test, also run against the packaged exe in CI
```

## Research

The feature set and interface follow a study of GoodNotes, Notability, OneNote, Samsung Notes, Nebo, Noteshelf, Flexcil, CollaNote, ZoomNotes, Xodo, Drawboard PDF and Canva. The study covered their features, what users praise and complain about on Windows, and the Fluent design guidelines. See [`docs/research/Feature and UX benchmark.md`](docs/research/Feature%20and%20UX%20benchmark.md).

## License

MIT
