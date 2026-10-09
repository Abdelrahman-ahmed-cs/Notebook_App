# UI/UX layout and interaction patterns for a professional Windows notebook app (Electron)

> Research note, 2026-10-09. **Source access caveat:** the research sandbox could not reach learn.microsoft.com, fluent2.microsoft.design, canva.com, support.goodnotes.com, help.figma.com, or most vendor sites directly (DNS/proxy blocked). Windows/Fluent facts below come from the **primary source files** on GitHub: the MicrosoftDocs `windows-dev-docs` repo (the markdown behind learn.microsoft.com), the WinUI `microsoft-ui-xaml` theme resource XAML, the `microsoft/fluentui` token source, and `microsoft/fluentui-system-icons`. App-specific facts (GoodNotes, Canva, Figma, Notability, Journal, OneNote, Drawboard) come from web-search extracts of official help pages, plus clearly labelled third-party guides and user-feedback forums. Exact pixel sizes of competitor toolbars are **not published** anywhere I could reach. Where this note gives px values for those, they are inferences based on Fluent tokens and are marked as such.

---

## 1. Top-level layout: where the tool palette, page sidebar, contextual bar, zoom and page counter live

### Takeaway
The ink-first note apps (GoodNotes, Notability, Journal, OneNote, Drawboard) use one **horizontal tool strip across the top**. It holds the drawing tools, and the selected tool's swatches and sizes appear inline to its right. Notability and Drawboard let users dock or float this strip. Page thumbnails go in a collapsible **left side panel**. Design editors (Canva, Figma) separate a **contextual property bar** that changes with the selection, and they put **floating mini-toolbars next to the selection**. Windows-native guidance (CommandBar and CommandBarFlyout) maps onto both patterns.

### Cited Findings
- GoodNotes 6 Pen tool: the toolbar shows "a preset stroke width and type, and color on the right-hand side". So the active tool's options appear inline in the top toolbar, not in a separate panel. — [GoodNotes Pen Tool (official Notion help)](https://goodnotes-team.notion.site/Pen-Tool-26fb740273d2818dbb55fe352d8fa431)
- GoodNotes users ask for a movable toolbar ("ability to put the tool bar on the side or bottom"). This implies the default is a fixed top bar. — [GoodNotes feedback: Moveable Tool Bar](https://feedback.goodnotes.com/forums/191274-customer-suggestions-for-goodnotes/suggestions/44791201-moveable-tool-bar-i-e-ability-to-put-the-tool-ba)
- GoodNotes (Windows/Android/web feedback): users want a *persistent* thumbnail sidebar "similar to Preview on Mac and Notability". They say the preview thumbnails are too small and the sidebar size can't be customized. They also say "Select pages" and the sidebar/popup toggle sit behind a three-dots menu in the page browser. Windows users request space-to-pan, Ctrl+wheel zoom, and typing a page number to jump. — [GoodNotes feedback (Windows forum)](https://feedback.goodnotes.com/forums/950440-how-can-we-improve-goodnotes-for-windows/filters/hot?page=69); [Features suggestion on Goodnotes Windows](https://feedback.goodnotes.com/forums/950440-customer-suggestions-for-goodnotes-android-windo/suggestions/48689756-features-suggestion-on-goodnotes-windows)
- Notability 14.3: holding the Toolbox lets you place it "on any of the four sides of the screen". Users can reorder or hide tools and reset to the default layout. — [La Salle Falconer, 2024](https://lasallefalconer.com/2024/01/mastering-notability-tips-and-tricks-for-ultimate-note-taking-success)
- Notability toolbar tools (third-party KB): pen, pencil, highlighter, eraser, text, select (lasso), media, audio. — [FAU Notability tips](https://comsupport.fau.edu/kb/articles/pdf/notability-tips-tricks); [Gingerlabs Getting Started](https://support.gingerlabs.com/hc/en-us/articles/4867633230234-Getting-Started-with-Notability)
- Drawboard PDF Markup Toolbar (Windows): "sits at the top of the canvas and can be docked or floated". Tool properties such as color, stroke weight and opacity "can be pinned to the right-hand side". There is also an optional floating **radial menu** (Settings > View & layout > Use radial menu). — [Drawboard: Using the Markup Toolbar on Windows](https://support.drawboard.com/hc/en-us/articles/15630133419279-Drawboard-PDF-Using-the-Markup-Toolbar-on-Windows); [Drawboard blog: new Markup Toolbar](https://www.drawboard.com/blog/new-markup-toolbar-drawboard-pdf-windows); [Drawboard 12 features](https://www.drawboard.com/blog/12-drawboard-pdf-features-and-tricks-to-increase-productivity-that-you-might-not-know-about)
- Microsoft Journal: the toolbar holds pen, highlighter and pencil slots (each with type, tip size and color), plus eraser, insert, and undo/redo. A "Page Position" setting decides which side the side panel appears on. — [Microsoft Support: Journal Pen Toolbar](https://support.microsoft.com/en-us/journal/pen-toolbar); [Office Watch](https://office-watch.com/2022/journal-ink-app-microsoft/)
- OneNote "Pen Focused View" on Windows has a pen toolbar holding Undo, Redo, Lasso Select, Stroke Eraser and pens. Pen color and thickness change directly from it. The classic Draw tab is a ribbon with a pen gallery and a "More" button. — [Microsoft Insider: Pen Focused View](https://insider.office.com/en-us/blog/pen-focused-view-in-onenote-on-windows); [Microsoft Support: Draw and sketch in OneNote](https://support.microsoft.com/topic/82d1189d-eb6d-4b07-9101-b50e13645c28)
- Canva: the floating/contextual toolbar contains the general element controls, in this order: position, copy style, transparency, link, lock, duplicate, delete (third-party KB of the current UI). — [PLU KB: Canva](https://kb.plu.edu/110125)
- Windows CommandBar: "the primary command area is aligned to the right side of the bar". A "see more" […] button reveals labels and an overflow menu. When the width shrinks, primary commands dynamically move into overflow ("add commands in order of their importance"). At 320 epx width, at most 4 primary commands fit. — [windows-dev-docs: Command bar](https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/develop/ui/controls/command-bar.md)
- Windows 11 uses a **two-layer system**. The *base* layer holds app menus, commands and navigation. The *content* layer holds the central experience (for a notebook app, the canvas). — [windows-dev-docs: Layering](https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/design/signature-experiences/layering.md)

### Inferences
- **Recommended layout (implementable), from top to bottom:**
  1. **Title bar, 48px.** Use a custom Electron `titleBarOverlay` with the window controls at the right. It holds the app icon, notebook name with breadcrumb, and a centered search box (optional). It sits on the base layer (Mica-like `#F3F3F3` light / `#202020` dark).
  2. **Tool bar, 48px**, base layer, three zones:
     - *Left*: sidebar toggle, undo, redo.
     - *Center*: the tool group: Select/Lasso, Pen, Highlighter, Eraser, Text, Shapes, Image, then a 1px divider and a **contextual cluster** with the active tool's 3 to 5 color swatches and 3 size dots (GoodNotes/Journal model).
     - *Right*: add page, share/export, "…" overflow.
     - Buttons follow the CommandBar priority-overflow rule.
  3. **Left page sidebar, about 200 to 240px**, collapsible, on the content layer. See §5.
  4. **Canvas**, on a neutral backdrop (`#F3F3F3` / `#1C1C1C`) with paper pages rendered as white cards.
  5. **Bottom-right floating status pill**: zoom (− 100% +, plus fit button) and page counter "3 / 12" (click to type a page number). This sits on the canvas, not in a status bar, in the style of Figma, Canva and GoodNotes. It also answers the GoodNotes Windows users' "type a page number" request.
- Design-style objects (text boxes, images, shapes) should **not** add another fixed bar. Use a floating contextual toolbar above the selection (Canva/CommandBarFlyout pattern, §3–4). This keeps the top bar stable, so it doesn't jump around when the selection changes.
- Offer a "floating/docked" toggle for the tool bar only as a later enhancement. Drawboard and Notability support it, but a fixed top bar is the predictable default on desktop.

### Gaps
- No official pixel dimensions for GoodNotes, Notability, Canva or Journal toolbars could be retrieved (vendor help sites unreachable, and vendors rarely publish px). The 48px heights above are inferred from Windows CommandBar and title-bar conventions, not measured.
- I couldn't verify whether GoodNotes for Windows centers its toolbar tools or left-aligns them.
- Canva's zoom slider and page counter are at the bottom of its editor (from general knowledge). I did not re-verify this in a 2026 source.

---

## 2. Pen picker pattern: favorites/presets, swatches, thickness presets, "tap active tool again"

### Takeaway
Across GoodNotes, Drawboard, Journal and the WinUI InkToolbar, the convention is the same. **Selecting a tool shows a small set of preset color slots and stroke sizes inline. Tapping or clicking the already-active tool, or an active slot, opens a settings flyout** with the full palette, custom color (wheel/hex/eyedropper), and thickness and opacity sliders.

### Cited Findings
- GoodNotes 6:
  - Color slots sit to the right of the pen tool. Tapping a slot *again* opens a color chooser: palette, color wheel, HEX, or eyedropper, with "Add to Presets".
  - You can have **up to 12 color slots**. "+" at the end of the list adds one.
  - Remove a slot by tapping it twice, then Settings, then "Remove Selected Color Slot". You can't remove one if only **3** slots remain.
  
  — [GoodNotes Pen Tool](https://goodnotes-team.notion.site/Pen-Tool-26fb740273d2818dbb55fe352d8fa431)
- GoodNotes users ask for combined pen+color+thickness favorites ("4 (maybe even 5) preset pen-colors and -thicknesses displayed in the toolbar permanently"). This is a request, so the feature didn't exist as described when posted. — [GoodNotes feedback: more preset colors and thicknesses](https://feedback.goodnotes.com/forums/191274-customer-suggestions-for-goodnotes/suggestions/38727190-have-more-preset-colors-and-thicknesses-displayed); [Favorites pens as tools](https://feedback.goodnotes.com/forums/191274-customer-suggestions-for-goodnotes/suggestions/9870099--favorites-pens-as-tools)
- Drawboard PDF: "clicking the pen icon twice" opens the customization menu, with presets plus color, thickness and opacity. "+" on the toolbar adds new pen presets. — [Drawboard blog: how to draw on a PDF](https://www.drawboard.com/blog/how-to-draw-on-a-pdf-with-drawboard-pdf); [Drawboard Markup Toolbar](https://support.drawboard.com/hc/en-us/articles/15630133419279-Drawboard-PDF-Using-the-Markup-Toolbar-on-Windows)
- Microsoft Journal: each pen, highlighter and pencil slot has its own type, tip size and color. Settings reset per journal unless "Remember Pen State" is on. A pen's barrel button cycles pen, pencil and highlighter. Pressure sensitivity is off by default. — [Microsoft Support: Journal Pen Toolbar](https://support.microsoft.com/ar-SA/journal/pen-toolbar); [Office Watch](https://office-watch.com/2022/journal-ink-app-microsoft/)
- WinUI InkToolbar (the Windows standard ink toolbar):
  - Default order: **Ballpoint pen, Pencil, Highlighter, Eraser, Ruler**.
  - Ballpoint is a solid opaque stroke, pressure-dependent, with a default size of 2×2 px.
  - Pencil is a soft-edged, semi-transparent stroke whose opacity depends on pressure.
  - Highlighter is a semi-transparent overlay.
  - Each pen's flyout has a customizable color palette and size (min/max/default).
  
  — [Microsoft Learn: Inking controls (search extract)](https://learn.microsoft.com/en-au/windows/uwp/ui-input/inking-controls)
- OneNote: the pen gallery has a "More" button for all favorites and built-ins. "More Color and Thickness Options" opens a Pen Properties dialog. — [Microsoft Support: OneNote draw](https://support.microsoft.com/topic/82d1189d-eb6d-4b07-9101-b50e13645c28)
- Notability splits the eraser into a partial eraser and a whole-stroke eraser, and draws the highlighter as translucent ink. — [Gingerlabs Getting Started](https://support.gingerlabs.com/hc/en-us/articles/4867633230234-Getting-Started-with-Notability)

### Inferences
- **Recommended pen picker spec:**
  - **Tool buttons**: 40×40 px hit area, 20px Fluent icon, radius 4px. The selected state uses a subtle fill (`rgba(0,0,0,0.06)` light), an accent-colored icon, and **a 3px colored underline or dot showing the tool's current ink color**. That underline is a strong "pro" cue used by ink apps.
  - **Click the active tool again** to open a flyout (radius 8px, shadow16, 1px stroke) anchored below the button, about 280px wide. Contents, top to bottom:
    1. Pen type segmented control (Ballpoint / Fountain / Pencil)
    2. Thickness slider (0.5–12 px), with a live stroke preview
    3. Opacity slider (highlighter defaults to about 40%)
    4. Palette grid: 6 columns of 24px swatches, 4px gap
    5. "Custom…" (hex input plus eyedropper)
    6. Pressure sensitivity toggle
  - **Inline swatches** next to the tools: default **5 slots**, configurable 3–12 to match GoodNotes's limits. Each is a 20px circle in a 32px hit area. The selected swatch gets a 2px ring in the text color with 2px offset (`box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--fg)`). Clicking a selected swatch opens the color flyout.
  - **Thickness presets**: **3 dots** (for example 4/7/10 px diameter, visually mapped to 1/2.5/5 pt strokes) in 32px hit areas. Same ring treatment when selected.
  - **Per-tool memory**: each tool keeps its own color and size. Persist them across sessions by default; Journal's reset-per-notebook behavior is opt-in there, and users find resetting annoying.
  - **Suggested default ink palette** (my suggestion, not from a source; it is a restrained set that reads as "stationery"): black `#1F1F1F`, blue `#1D4ED8`, red `#D92D20`, green `#15803D`, orange `#EA580C`. Highlighter: yellow `#FFE45C`, green `#9BE7A0`, pink `#FFA3C7`, blue `#9CCBFF`. Avoid neon or purple-heavy palettes (see §6).

### Gaps
- GoodNotes's default preset colors and default stroke widths (mm values) were not retrievable.
- I couldn't find a source for the WinUI InkToolbar default palette count (some docs describe a fixed palette, but I couldn't access the full Learn page).

---

## 3. Selection UX: floating context menu, handles, rotation, snapping guide colors, distance labels

### Takeaway
After a selection, polished apps show a **compact floating command bar near the selection** (GoodNotes "Object Menu", Canva floating toolbar, Windows CommandBarFlyout). Handles distinguish scale, resize and rotate, with rotation as a **protruding handle**. Snapping and measurement use a **single saturated contrast color**: Figma uses **red** measurement lines, and Canva uses **pink/magenta** guides.

### Cited Findings
- GoodNotes lasso:
  - The menu after selection includes Cut / Copy / Duplicate / Delete, Resize (resize or rotate), Screenshot (rectangular), and Convert (handwriting to text or math, with a choice of recognition language).
  - The lasso is freehand by default, with an optional rectangle mode.
  - **Handles**: "White corner squares: Scale; Blue circles: Resize; White protruding circle: Rotate."
  - In vertical scroll mode, a selection can move across page boundaries.
  
  — [GoodNotes support: lasso (7353695644175)](https://support.goodnotes.com/hc/en-us/articles/7353695644175); [GoodNotes Lasso Tool (Notion)](https://goodnotes-team.notion.site/Lasso-Tool-26fb740273d281008fc5edc2539b2b7b). An older GoodNotes page said cross-page moves were not possible, which conflicts with the current article: [Lasso Tool (older)](https://goodnotes-team.notion.site/Lasso-Tool-60ae55e0ecfc45ee867bd10a0132fde9)
- Notability 14 lasso has freeform and box modes for resize, rotate and move across pages. — [Udemy: Notability 14 course](https://www.udemy.com/course/notability-14-beginner-friendly-course/)
- Microsoft Journal "instant lasso": circling ink with the pen selects it without switching tools. Tapping ink selects a word, and Ctrl+tap multi-selects. — [Office Watch](https://office-watch.com/2022/journal-ink-app-microsoft/); [ElevenForum: Journal update](https://www.elevenforum.com/t/new-microsoft-journal-app-update-for-windows-10-and-windows-11.1340/latest)
- Windows **CommandBarFlyout** is "the recommended control for creating context menus":
  - Common commands (Copy, Cut, Paste, Delete, Share) go in a single horizontal row of primary commands. "…" expands to secondary commands.
  - *Proactive* invocation (on selection) shows the flyout collapsed, **without taking focus**, and it dismisses if ignored.
  - *Reactive* invocation (right-click) opens it expanded.
  
  — [windows-dev-docs: Command bar flyout](https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/develop/ui/controls/command-bar-flyout.md)
- Figma: Alt-hover over another object shows "a red line between the two objects, as well as horizontal and vertical measurements". "It's not currently possible to change the weight or color of the red measurement line." — [Figma Help: Measure distances](https://help.figma.com/hc/en-us/articles/360039956974); [designcode.io: Measure Distance](https://designcode.io/figma-handbook-measure-distance)
- Canva: rulers and guides appear as **pink** guide lines. Canva shows alignment guides when elements are centered or aligned. One tutorial says holding Alt shows measured distances to nearby objects (single source, unverified). "Position → Tidy up" spaces multiple elements evenly. — [Blogging Guide: rulers and guides in Canva](https://bloggingguide.com/how-to-use-rulers-and-guides-in-canva/); [Trupeer: even spacing in Canva](https://trupeer.ai/tutorials/how-to-evenly-space-elements-in-canva)
- Canva element toolbar: position, copy style, transparency, link, **lock**, **duplicate**, **delete**. Lock prevents accidental moves. — [PLU KB: Canva](https://kb.plu.edu/110125)

### Inferences
- **Recommended selection spec:**
  - **Bounding box**: 1px solid accent stroke (`#0F6CBD` light, `#479EF5` dark). It does not scale with zoom; always 1 screen px. Lasso path: 1px dashed accent (4/4 dash) with a marching-ants animation of 0.5s linear, plus a 6% accent fill.
  - **Handles**: 8 handles (4 corners and 4 edge midpoints). Each is an 8×8 px white square with a 1px accent border and 1px radius, and a 16px invisible hit area. Hide the edge handles when the box is under 24px.
  - **Rotation**: a 10px white circle with an accent border, 20px above the top-center, joined by a 1px stem (GoodNotes "protruding circle"). Hovering near a corner just outside the box shows a rotate cursor, as Figma does.
  - **Floating action bar** (Canva/CommandBarFlyout): 8px above the selection, horizontally centered; it flips below if there isn't room. It's 36px tall, 8px radius, flyout surface, shadow16, 1px stroke. Icon buttons are 32×32 (16 or 20px icons).
    - Ink selection order: **Copy · Duplicate · Delete | Color · Convert to text | …**
    - Object selection order: **Duplicate · Delete · Lock | Bring forward/back | …**
    - Show it after pointer-up, not during drag. Fade it in over 83–167ms (Windows motion, §6).
    - Right-click opens the same bar expanded with a vertical menu (CommandBarFlyout reactive mode).
  - **Snapping guides**: 1px lines in one dedicated "guide" color. Use **magenta `#E5007E`/pink** (Canva-like) or **red `#F24822`** (Figma-like). Pick one and never use it elsewhere in the UI.
  - **Distance labels**: a small pill with a 2px radius, a solid guide-color background, white 11px semibold text, and 2×4px padding (Figma style). Show it while dragging and when Alt-hovering.
  - **Snap threshold**: about 6 screen px (inferred; Figma and Canva don't publish theirs).

### Gaps
- Canva's and Figma's exact guide hex values, handle sizes and snap thresholds are not published in any source I could reach. The hex values above are suggestions.
- I didn't find a source for the exact placement of Canva's rotate handle (commonly below the element in Canva, but I couldn't verify this).

---

## 4. Canva contextual toolbar for text and images

### Takeaway
Canva's text toolbar runs, left to right, roughly: **font family → size (−/value/+) → text color "A" → B / I / U / S → alignment → list → spacing → effects → (animate) → position → transparency/lock/duplicate/delete**. The image toolbar leads with **Edit**, then crop, flip and border/corner rounding, then the shared element controls. Canva says the toolbar "may look slightly different" as options are added, so the exact order varies.

### Cited Findings
- Canva official help (Format text):
  - Font size is set from the toolbar, by preset, by typing, or with **plus/minus buttons**.
  - Bold, italics, underline and strikethrough are applied from the toolbar, as is text color.
  - Alignment is on the floating toolbar: Left, Center, Right, Justify.
  - The toolbar "may look slightly different" as new options are introduced.
  
  — [Canva Help: Format text](https://www.canva.com/help/format-text/)
- Canva Design School: **Effects** opens shadows, outlines, backgrounds and curved text. The toolbar also includes letter and line spacing. — [Canva: Finding fonts and using text](https://www.canva.com/design-school/resources/finding-fonts-and-using-text)
- Canva element controls (shared by text, images and graphics): position, copy style, transparency, link, lock, duplicate, delete. — [PLU KB: Canva](https://kb.plu.edu/110125); [PLU KB 110124](https://kb.plu.edu/110124)
- Canva images: the toolbar is similar to the graphics toolbar, with border, rounded corners and crop. **Edit** opens a *side panel* with Adjust, Magic Studio, Filters, Effects and Apps. **Flip** is horizontal or vertical. Crop is done by adjusting the frame, then **Done**. — [NSW Education: Canva Foundations – Editing tools transcript](https://education.nsw.gov.au/teaching-and-learning/technology-for-learning/resources/professional-learning-resources/canva-for-education/canva-foundations/transcript-canva-editing-tools); [Guiding Tech: edit images in Canva](https://www.guidingtech.com/how-to-edit-images-in-canva/)
- Transparency is a slider (third-party). — [Cal Poly-hosted guide (third-party, low quality)](https://grandavehousing.calpoly.edu/news/edit-text-in-canva-a)

### Inferences
- **Recommended text toolbar** (floating above the selected text box, or docked as a 40px contextual row under the main tool bar; pick one model app-wide):
  1. **Font family dropdown**: 160px wide. Each list row previews the font in its own face, 32px tall. A "Recently used" section sits at the top, with a search field.
  2. **Size stepper**: `[−] [ 16 ] [+]`, 28px buttons and a 40px numeric input. Typing or the wheel changes the value; the dropdown offers presets 8–72.
  3. **Text color**: an "A" glyph with a **4px color bar underneath** showing the current color. Click opens the swatch flyout.
  4. **B / I / U / S**: toggle buttons. Pressed state is a subtle fill plus accent icon.
  5. **Alignment**: a single button that **cycles** left → center → right → justify on click, with its icon reflecting the state. Alt+click or a chevron opens the full list.
  6. **List**: bullets or numbers (cycles none → bullet → numbered).
  7. **Spacing**: opens a popover with letter-spacing and line-height sliders plus numeric fields.
  8. **Divider, then Effects** (shadow/outline/highlight background). Optional for a notebook app.
  9. **Position, Transparency, Lock**.
  10. **"…"** overflow (duplicate, delete, copy style).
- **Image toolbar**: **Crop** (enters crop mode with a dimmed outside area and Done/Cancel) · **Flip ▾** (horizontal/vertical) · **Rotate 90°** · **Border/Corner radius** · Transparency · Replace · Lock · "…". Keep "Edit/filters" out of v1 unless image filters are a feature.
- Keep labels as **icons with tooltips** ("Bold (Ctrl+B)"). Show text labels only where the icon is ambiguous ("Effects", "Position"), as Canva does.

### Gaps
- Canva's exact 2026 control order couldn't be read from canva.com (blocked). The order above is a synthesis of the official text-help extract and third-party KBs, and Canva itself says it changes.
- I found no official mention of a "cycling alignment button" or "list" button in the reachable text. This comes from widely observed Canva UI behavior and should be treated as unverified.

---

## 5. Page sidebar: thumbnails, page numbers, add page, reorder, context menu

### Takeaway
Users of every app expect a **left thumbnail strip** that is **resizable or zoomable**, shows the page number, supports drag-reorder, and offers a page context menu (add before/after, duplicate, delete, template, bookmark). GoodNotes's "Add page → Before / After / Last" and users' complaints about tiny, non-resizable thumbnails are the clearest guidance.

### Cited Findings
- GoodNotes: an **Add Page** icon near the top-right offers **Before / After / Last Page**. A preview of the current page template appears, and tapping it duplicates the page. — [GoodNotes support (7353728016655)](https://support.goodnotes.com/hc/en-us/articles/7353728016655); [COF digital planner instructions](https://www.cof.org/sites/default/files/documents/files/InstructionsforDigitalplanners.pdf)
- GoodNotes: pulling past the last page adds a page, but users report it duplicates the last page rather than adding a blank one. They want a one-step duplicate of the current page. — [GoodNotes feedback: Pull to add NEW page](https://feedback.goodnotes.com/forums/191274-customer-suggestions-for-goodnotes/suggestions/45594754-pull-to-add-new-page-rather-than-duplicate-last-pa); [Ability to quickly duplicate current page](https://feedback.goodnotes.com/forums/191274-customer-suggestions-for-goodnotes/suggestions/10634460-ability-to-quickly-duplicate-current-page)
- GoodNotes Windows/Android users: thumbnails are "too small to make out details", the sidebar size can't be customized, and they want a persistent sidebar like Preview or Notability. One bug: dragging thumbnails in the sidebar version opened a copy of the notebook in a new window. — [GoodNotes Windows feedback](https://feedback.goodnotes.com/forums/950440-how-can-we-improve-goodnotes-for-windows/filters/hot?page=69)
- Older GoodNotes guide: the three-dot menu at top right has "Copy Page". — [GoodNotes user guide (Scribd)](https://www.scribd.com/document/702417520/GoodNotesUserGuide)

### Inferences
- **Recommended page sidebar spec:**
  - Width is **220px by default** and resizable from 160 to 360 px via a 4px drag handle on the right edge. Thumbnails scale with it, which solves the GoodNotes complaint. Collapse with Ctrl+\ or the title-bar toggle.
  - Header (40px): "Pages" in 14px semibold, a page count, a view toggle (thumbnails / outline-bookmarks), and "+" (add page).
  - **Thumbnail**:
    - The rendered page fits the column width minus 32px padding, about **156×202 px** at A4/Letter ratio in a 220px panel. It is a white card with 2px radius, a 1px `rgba(0,0,0,0.06)` stroke and shadow2.
    - The **page number sits centered below** the thumbnail in 12px caption, secondary text color.
    - Vertical gap: 16px.
  - **Current page**: a **2px accent outline with 2px offset** (not a fill), and the page number turns accent and semibold. Hover adds a subtle fill behind the card at 4px radius.
  - **Insert affordance between pages**: hovering the gap shows a 2px accent line with a centered **20px circular "+" button**, which inserts a blank page there. This answers the "add a page here" need without menus.
  - **Drag reorder**: the dragged thumbnail is lifted (shadow16, 0.9 opacity, scale 1.02). A **2px accent insertion line** spans the column between targets, and the list auto-scrolls near the edges. Multi-select uses Ctrl/Shift+click, as in Windows lists.
  - **Context menu** (right-click or a "…" on hover), 8px radius flyout, 32px rows:
    - Add page before, Add page after, Duplicate, divider
    - Change template…, Rotate, divider
    - Bookmark, Copy, Export page…, divider
    - **Delete** (red text only for destructive)
  - Keyboard: ↑/↓ moves the selection, Delete deletes (with undo toast), Ctrl+D duplicates.
- Show a **"+ Add page" ghost card** at the end of the list, as an explicit alternative to pull-to-add. Make it blank by default to avoid the GoodNotes duplicate complaint.

### Gaps
- No vendor publishes thumbnail pixel sizes. The values above are inferred.
- I found no reachable Notability documentation on its page sidebar behavior.

---

## 6. Visual design conventions: Fluent 2 / Windows 11 tokens, and what reads as "AI slop"

### Takeaway
Windows 11 "professional" comes from restraint:
- **neutral gray layers** (Mica-like base `#F3F3F3`/`#202020`, cards on top)
- **4px radius for controls, 8px for windows/flyouts/dialogs**
- **Segoe UI Variable** at a strict ramp (12/14/20/28)
- **one accent color used sparingly** for state and interactivity
- **20px monochrome Fluent System Icons**
- **subtle 1px strokes plus shallow shadows only for elevated surfaces**
- **acrylic only on transient flyouts**

The "AI-generated" look comes from violating exactly these: purple/indigo gradients, glow and glassmorphism everywhere, emoji as icons, inconsistent radii, and decorative shadows.

### Cited Findings — Geometry
- Corner radius: **8px** for top-level containers (app windows, flyouts, dialogs). **4px** for in-page elements (buttons, list backplates) and controls (Button, CheckBox, ComboBox, TextBox, ListView). **4px** for bar elements (ProgressBar, ScrollBar, Slider) and ToolTip. **0px** where straight edges meet other edges (for example the two halves of a SplitButton) and on maximized or snapped windows. A flyout attached to its invoker is not rounded on the attached side. Global resources: `ControlCornerRadius` = 4, `OverlayCornerRadius` = 8. — [windows-dev-docs: Geometry](https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/design/signature-experiences/geometry.md)
- Fluent 2 web radius tokens: none 0, small 2px, medium 4px, large 6px, xLarge 8px, 2xLarge 12px, 3xLarge 16px, 4xLarge 24px, 5xLarge 32px, 6xLarge 40px, circular. — [fluentui tokens: borderRadius.ts](https://raw.githubusercontent.com/microsoft/fluentui/master/packages/tokens/src/global/borderRadius.ts)
- Fluent 2 spacing tokens: 0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32 px (xxs…xxxl). — [fluentui tokens: spacings.ts](https://raw.githubusercontent.com/microsoft/fluentui/master/packages/tokens/src/global/spacings.ts)

### Cited Findings — Typography
- Segoe UI Variable has weight and optical-size axes; optical size is automatic, scaling for 8–36pt. In HTML you must specify `Segoe UI Variable` in CSS, and optical scaling is then automatic. Weights: Light 300, Semilight 350, Regular 400, Semibold 600, Bold 700. — [windows-dev-docs: Typography](https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/design/signature-experiences/typography.md)
- Type ramp (size/line-height, epx):

  | Style | Weight | Size / line height |
  |---|---|---|
  | Caption | Regular | 12/16 |
  | Body | Regular | 14/20 |
  | Body Strong | Semibold | 14/20 |
  | Body Large | Regular | 18/24 |
  | Subtitle | Semibold (Display) | 20/28 |
  | Title | Semibold | 28/36 |
  | Title Large | Semibold | 40/52 |
  | Display | Semibold | 68/92 |

  Rules: Regular for most text and Semibold for titles. Minimum sizes are 14px Semibold and 12px Regular. **Sentence case for all UI text, including titles.** Left-align by default. Truncate with ellipses. Use one font throughout the app UI. — [windows-dev-docs: Typography](https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/design/signature-experiences/typography.md)

### Cited Findings — Materials and elevation
- **Mica**: an opaque base-layer material tinted by the desktop wallpaper. It is mode-aware and shows active/inactive window state. **Acrylic**: semi-transparent frosted glass, "used only for transient, light-dismiss surfaces such as flyouts and context menus". **Smoke**: translucent black behind modal dialogs, not mode-aware. — [windows-dev-docs: Materials](https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/design/signature-experiences/materials.md)
- Acrylic guidance: "Avoid layering multiple acrylic surfaces", and don't place acrylic pieces edge-to-edge (it causes seams). For vertical panes that section off content, "use an opaque background instead of acrylic". Misused acrylic "can result in visual noise". — [windows-dev-docs: Acrylic](https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/design/style/acrylic.md)
- Elevation values (every level also has a stroke width of 1): Window 128, Dialog 128, Flyout 32, Tooltip 16, Card 8, Control 2, Layer 1. Controls: rest 2, hover 2, pressed 1. "Overusing shadows… can diminish their impact and create visual noise"; use shadows "purposefully — rather than decoratively". — [windows-dev-docs: Layering](https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/design/signature-experiences/layering.md)
- Fluent 2 web shadow recipe:
  - shadow2 = `0 0 2px A, 0 1px 2px K`
  - shadow4 = `0 0 2px A, 0 2px 4px K`
  - shadow8 = `0 0 2px A, 0 4px 8px K`
  - shadow16 = `0 0 2px A, 0 8px 16px K`
  - shadow28 = `0 0 8px A, 0 14px 28px K`
  - shadow64 = `0 0 8px A, 0 32px 64px K`
  
  Light A/K = `rgba(0,0,0,.12)` / `rgba(0,0,0,.14)`. Dark A/K = `rgba(0,0,0,.24)` / `rgba(0,0,0,.28)`. — [fluentui tokens: shadows.ts](https://raw.githubusercontent.com/microsoft/fluentui/master/packages/tokens/src/utils/shadows.ts); [lightColor.ts](https://raw.githubusercontent.com/microsoft/fluentui/master/packages/tokens/src/alias/lightColor.ts); [darkColor.ts](https://raw.githubusercontent.com/microsoft/fluentui/master/packages/tokens/src/alias/darkColor.ts)

### Cited Findings — Color tokens
- WinUI theme resources (XAML `#AARRGGBB`, converted here to CSS):

  | Token | Light | Dark |
  |---|---|---|
  | SolidBackgroundBase (app bg) | `#F3F3F3` | `#202020` |
  | SolidBackgroundSecondary | `#EEEEEE` | `#1C1C1C` |
  | SolidBackgroundTertiary | `#F9F9F9` | `#282828` |
  | SolidBackgroundQuarternary | `#FFFFFF` | `#2C2C2C` |
  | LayerFillDefault (content layer) | `rgba(255,255,255,.5)` | `rgba(58,58,58,.3)` |
  | CardBackgroundDefault | `rgba(255,255,255,.7)` | `rgba(255,255,255,.05)` |
  | CardStrokeDefault | `rgba(0,0,0,.06)` | `rgba(0,0,0,.10)` |
  | TextPrimary | `rgba(0,0,0,.894)` | `#FFFFFF` |
  | TextSecondary | `rgba(0,0,0,.62)` | `rgba(255,255,255,.786)` |
  | TextTertiary | `rgba(0,0,0,.447)` | `rgba(255,255,255,.53)` |
  | TextDisabled | `rgba(0,0,0,.36)` | `rgba(255,255,255,.365)` |
  | ControlFillDefault | `rgba(255,255,255,.7)` | `rgba(255,255,255,.06)` |
  | ControlFillSecondary (hover) | `rgba(249,249,249,.5)` | `rgba(255,255,255,.08)` |
  | ControlFillTertiary (pressed) | `rgba(249,249,249,.3)` | `rgba(255,255,255,.03)` |
  | SubtleFillSecondary (ghost hover) | `rgba(0,0,0,.035)` | `rgba(255,255,255,.06)` |
  | SubtleFillTertiary (ghost pressed) | `rgba(0,0,0,.024)` | `rgba(255,255,255,.04)` |
  | ControlStrokeDefault | `rgba(0,0,0,.06)` | `rgba(255,255,255,.07)` |
  | ControlStrokeSecondary (bottom edge) | `rgba(0,0,0,.16)` | `rgba(255,255,255,.094)` |
  | ControlStrongStroke | `rgba(0,0,0,.447)` | `rgba(255,255,255,.545)` |
  | DividerStroke | `rgba(0,0,0,.06)` | `rgba(255,255,255,.08)` |
  | SurfaceStrokeFlyout | `rgba(0,0,0,.06)` | `rgba(0,0,0,.20)` |
  | FocusStrokeOuter / Inner | `rgba(0,0,0,.894)` / `rgba(255,255,255,.7)` | `#FFFFFF` / `rgba(0,0,0,.7)` |
  | SmokeFill | `rgba(0,0,0,.3)` | `rgba(0,0,0,.3)` |

  — [microsoft-ui-xaml: Common_themeresources_any.xaml](https://raw.githubusercontent.com/microsoft/microsoft-ui-xaml/main/controls/dev/CommonStyles/Common_themeresources_any.xaml)
- Fluent 2 web neutrals: light Background1 `#FFFFFF`, Background2 `#FAFAFA`, Background3 `#F5F5F5`, Foreground1 `#242424`, Foreground2 `#424242`, Stroke1 `#D1D1D1`, Stroke2 `#E0E0E0`, overlay `rgba(0,0,0,.4)`. Dark Background1 `#292929`, Background2 `#1F1F1F`, Background3 `#141414`, Foreground1 `#FFFFFF`, Foreground2 `#D6D6D6`, Stroke1 `#666666`, overlay `rgba(0,0,0,.5)`. Focus stroke is black in light and white in dark. — [lightColor.ts](https://raw.githubusercontent.com/microsoft/fluentui/master/packages/tokens/src/alias/lightColor.ts); [darkColor.ts](https://raw.githubusercontent.com/microsoft/fluentui/master/packages/tokens/src/alias/darkColor.ts)
- Fluent 2 web brand ramp (`brandWeb`): 60 `#0F548C`, 70 `#115EA3`, **80 `#0F6CBD`** (primary in light), 90 `#2886DE`, **100 `#479EF5`** (brand foreground in dark), 110 `#62ABF5`, 150 `#CFE4FA`, 160 `#EBF3FC`. Note: the code comments in lightColor.ts show `#0078d4` (the legacy Windows default accent), but the actual brandWeb ramp value at 80 is `#0F6CBD`. — [fluentui tokens: brandColors.ts](https://raw.githubusercontent.com/microsoft/fluentui/master/packages/tokens/src/global/brandColors.ts)
- Color principles: in both modes, darker surfaces are less important and lighter ones more important. "Accent colors are used sparingly to highlight important elements and convey… state". "Choose one color to indicate elements… that are interactive". Don't rely on red and green as the sole differentiator; about 8% of men are red-green colorblind. — [windows-dev-docs: Color](https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/design/signature-experiences/color.md)

### Cited Findings — Motion
- Windows motion:
  - Direct entrance: `cubic-bezier(0,0,0,1)` at 167/250/333ms
  - Point-to-point: `cubic-bezier(0.55,0.55,0,1)`
  - Exit: `cubic-bezier(0,0,0,1)` at 167ms, always combined with a fade
  - Fade: linear 83ms
  
  WinUI resources: ControlFasterAnimationDuration 83ms, ControlFastAnimationDuration 167ms, ControlNormalAnimationDuration 250ms, ControlFastOutSlowInKeySpline 0,0,0,1. — [windows-dev-docs: Motion](https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/design/signature-experiences/motion.md); [Common_themeresources_any.xaml](https://raw.githubusercontent.com/microsoft/microsoft-ui-xaml/main/controls/dev/CommonStyles/Common_themeresources_any.xaml)
- Fluent 2 web durations: 50 / 100 / 150 / 200 / 250 / 300 / 400 / 500 ms. — [durations.ts](https://raw.githubusercontent.com/microsoft/fluentui/master/packages/tokens/src/global/durations.ts)

### Cited Findings — Icons
- Fluent UI System Icons, published as `@fluentui/svg-icons`:
  - Names follow `name_size_style`. Styles are `regular`, `filled`, and `color` (color is deprecated). Regular and filled inherit `currentColor`, so they are themeable.
  - Sizes 16/20/24/28/48 (some also 10/12/32).
  - In the regular list, 20px is among the best-covered sizes (about 3,178 icons; 24px about 3,784).
  - Notebook-relevant 20px icons exist: `eraser`, `eraser_tool`, `highlight`, `hand_draw`, `hand_left` (pan), `cursor`, `crop`, `flip_horizontal`, `arrow_rotate_clockwise`, `arrow_undo`, `arrow_redo`, `copy`, `cut`, `delete`, `document_add`, `image_add`, `color`, `color_line`.
  
  — [fluentui-system-icons: svg-icons README](https://raw.githubusercontent.com/microsoft/fluentui-system-icons/main/packages/svg-icons/README.md); [icons_regular.md](https://raw.githubusercontent.com/microsoft/fluentui-system-icons/main/icons_regular.md)

### Cited Findings — "AI slop" tells
- The common vocabulary of generic AI UIs: Inter/Roboto, a **purple-to-indigo gradient** on white or light gray, a centered hero with one CTA, and three rounded cards with little icons. This is attributed partly to Tailwind's `bg-indigo-500` default, and Adam Wathan apologized for it. — [prg.sh: Why your AI keeps building the same purple gradient website](https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website)
- **Emoji as icons** (sparkles, rockets, lightning) is a tell; replace them with SVG icons. Glowing hero backgrounds and gradient blobs "do not communicate state" and signal that the "AI tried to make it feel premium". Use color semantically, not decoratively. — [Laith0003 ux-skill wiki: How to detect AI slop](https://github.com/Laith0003/ux-skill/wiki/How-to-detect-AI-slop-in-your-design); [Fountain Institute: 7 tells a UI is AI-generated](https://pages.thefountaininstitute.com/posts/7-tells-that-a-ui-is-ai-generated); [Superdesign: why AI design looks generic](https://www.superdesign.dev/blog/why-ai-design-looks-generic); [Kosta Canatselis: Spot the slop](https://world.hey.com/kostac/spot-the-slop-a-ui-designer-s-guide-to-fixing-ai-defaults-4c448c9c)
- These AI-slop sources are opinion and blog pieces, not measured studies.

### Inferences
- **CSS token starter** (derived directly from the cited tokens):
  ```css
  :root{
    --font-ui:"Segoe UI Variable Text","Segoe UI Variable","Segoe UI",system-ui,sans-serif;
    --fs-caption:12px/16px; --fs-body:14px/20px; --fs-body-lg:18px/24px; --fs-subtitle:20px/28px; --fs-title:28px/36px;
    --r-control:4px; --r-overlay:8px; --r-sm:2px;
    --bg-base:#F3F3F3; --bg-canvas:#EEEEEE; --bg-layer:#F9F9F9; --bg-card:#FFFFFF; --paper:#FFFFFF;
    --fg1:rgba(0,0,0,.894); --fg2:rgba(0,0,0,.62); --fg3:rgba(0,0,0,.447); --fg-disabled:rgba(0,0,0,.36);
    --stroke-card:rgba(0,0,0,.06); --stroke-control:rgba(0,0,0,.06); --stroke-control-bottom:rgba(0,0,0,.16); --divider:rgba(0,0,0,.06);
    --fill-subtle-hover:rgba(0,0,0,.035); --fill-subtle-press:rgba(0,0,0,.024);
    --accent:#0F6CBD; --accent-hover:#115EA3; --accent-press:#0F548C; --accent-fg:#FFFFFF; --accent-subtle:#EBF3FC;
    --shadow-2:0 0 2px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.14);
    --shadow-8:0 0 2px rgba(0,0,0,.12),0 4px 8px rgba(0,0,0,.14);
    --shadow-16:0 0 2px rgba(0,0,0,.12),0 8px 16px rgba(0,0,0,.14);
    --shadow-28:0 0 8px rgba(0,0,0,.12),0 14px 28px rgba(0,0,0,.14);
    --ease-out:cubic-bezier(0,0,0,1); --ease-move:cubic-bezier(0.55,0.55,0,1); --dur-fast:167ms; --dur-normal:250ms; --dur-fade:83ms;
  }
  [data-theme=dark]{
    --bg-base:#202020; --bg-canvas:#1C1C1C; --bg-layer:#282828; --bg-card:#2C2C2C; --paper:#FFFFFF; /* keep paper white or offer a dark-paper option */
    --fg1:#FFFFFF; --fg2:rgba(255,255,255,.786); --fg3:rgba(255,255,255,.53); --fg-disabled:rgba(255,255,255,.365);
    --stroke-card:rgba(0,0,0,.10); --stroke-control:rgba(255,255,255,.07); --stroke-control-bottom:rgba(255,255,255,.094); --divider:rgba(255,255,255,.08);
    --fill-subtle-hover:rgba(255,255,255,.06); --fill-subtle-press:rgba(255,255,255,.04);
    --accent:#479EF5; --accent-hover:#62ABF5; --accent-press:#2886DE; --accent-fg:#000000;
    --shadow-2:0 0 2px rgba(0,0,0,.24),0 1px 2px rgba(0,0,0,.28);
    --shadow-16:0 0 2px rgba(0,0,0,.24),0 8px 16px rgba(0,0,0,.28);
  }
  ```
- **Control sizes** (WinUI conventions; partly inferred):
  - Standard button, input and combo: 32px tall, 4px radius, 1px stroke, with a slightly darker bottom stroke (`--stroke-control-bottom`). This is the subtle Fluent "elevation 2" look.
  - Toolbar icon buttons: 40×40 in the main bar, 32×32 in floating bars. These are "subtle" buttons with a transparent rest state.
  - Menu rows: 32px with 12px horizontal padding.
  - Flyouts: 8px radius, 4px internal padding, shadow16 (elevation 32 ≈ shadow28 for menus).
  - Tooltips: 4px radius, 12px caption, shown after about 500ms.
- **Focus ring**: a two-ring Fluent pattern, 2px outer `--fg1` and 1px inner white, via `outline: 2px solid var(--fg1); outline-offset: 1px; box-shadow: 0 0 0 1px var(--bg-card) inset`. Show it on `:focus-visible` only.
- **Use materials honestly in Electron**: on Windows 11, Electron's `backgroundMaterial: 'mica'` (BrowserWindow option) can give real Mica to the title bar and base layer. Use acrylic or `backdrop-filter` **only** on menus and flyouts. The page sidebar should be opaque, per the acrylic guidance.
- **Anti-slop checklist for this app**:
  - Neutral gray chrome. One blue accent, only for selection, focus and primary buttons.
  - No gradients on chrome. No glow, no glassmorphism on panels.
  - Fluent regular 20px icons everywhere, with filled variants only for the *selected* tool (Windows convention). No emoji.
  - Exactly two radii (4/8), plus 2px for thumbnails and handles.
  - Shadows only on floating things: flyouts, the floating selection bar, dragged thumbnails, and paper pages (shadow2).
  - Sentence-case labels.
  - Real content density: 14px body, not 16–18px "marketing" sizes.
  - Ink colors are the only saturated colors on screen.
- Paper pages are the hero of the app. Render them as white sheets with shadow2 and a 1px `--stroke-card`, centered on a `#EEEEEE`/`#1C1C1C` canvas with a 24–32px gap between pages. This "desk and paper" contrast is what makes GoodNotes and Notability feel premium.

### Gaps
- fluent2.microsoft.design pages (Fluent 2 "Shapes", "Elevation", "Iconography" web pages) were unreachable. Values came from the token source code instead, which is authoritative for Fluent 2 web.
- No official Fluent spec for a "focus ring" pixel recipe was retrieved (only the FocusStrokeOuter and Inner colors). The 2px/1px recipe is the WinUI default from general knowledge, not re-verified.
- Electron's `backgroundMaterial` option is from general knowledge of Electron ≥ 24. I did not re-verify it against current Electron docs in this session.

---

## 7. Keyboard and mouse conventions

### Takeaway
Use Figma/Canva/Windows-standard conventions:
- **Ctrl+wheel** zooms toward the cursor and **pinch** zooms.
- **Space+drag**, **middle-drag** or **H** pans.
- Single-letter tool keys (V, P, H, E, T…), **Esc** to deselect.
- **Ctrl+D** duplicates, **Ctrl+G** groups, **Ctrl+[ / ]** changes layer order, and **Shift+1** zooms to fit.

GoodNotes Windows users explicitly request space-pan and Ctrl+wheel zoom, which confirms these are expected.

### Cited Findings
- Figma: **V** Move, **H** Hand, and holding **Space** temporarily pans. **Shift+1** zooms to fit. Sources conflict on zoom to 100% (**Shift+0** in one cheat sheet, **Ctrl+0** in another). — [Verpex: Essential Figma Shortcuts](https://verpex.com/blog/marketing-tips/essential-figma-shortcuts-you-need-to-know); [Raycast Figma Shortcuts](https://www.raycast.com/arturdz/figma-shortcuts); [Figma Help: Move around](https://help.figma.com/hc/en-us/articles/1500004414582); [Linuru Figma](https://linuru.com/figma/)
- Figma measurement modifiers: Alt-hover shows distances. Nested layers use Ctrl+Alt on Windows. — [Figma Help: measure](https://help.figma.com/hc/en-us/articles/360039956974)
- Canva: **T** text box, **R** rectangle, **L** line, **C** circle. **Ctrl+D** duplicate, **Ctrl+G** group, **Ctrl+Shift+G** ungroup. **Alt+drag** copies while dragging. **Ctrl+[ / ]** moves backward/forward. **Alt+Shift+L** locks. — [Jennifer Maker: Canva shortcuts](https://jennifermaker.com/canva-keyboard-shortcuts/); [Skillademia: Canva shortcuts](https://www.skillademia.com/shortcuts/canva-shortcuts/); [Linuru Canva](https://linuru.com/canva/)
- GoodNotes Windows feedback asks for spacebar hand tool, Ctrl+mouse wheel zoom, and typing a page number to jump. — [GoodNotes Windows feedback](https://feedback.goodnotes.com/forums/950440-how-can-we-improve-goodnotes-for-windows/filters/hot?page=69)
- Microsoft Journal: Ctrl+tap multi-selects ink. A pen barrel button cycles tools. — [ElevenForum](https://www.elevenforum.com/t/new-microsoft-journal-app-update-for-windows-10-and-windows-11.1340/latest); [Office Watch](https://office-watch.com/2022/journal-ink-app-microsoft/)
- The WinUI ruler snaps ink drawn near its edge. — [Microsoft Learn: Inking controls (search extract)](https://learn.microsoft.com/en-au/windows/uwp/ui-input/inking-controls)

### Inferences
- **Recommended shortcut map**:

  | Group | Shortcuts |
  |---|---|
  | Tools | **V** select, **L** lasso, **P** pen, **H** highlighter, **E** eraser, **T** text, **S** shapes, **I** image, **R** ruler |
  | Hand / pan | Space (hold) or middle-drag. H is taken by highlighter, so offer a toolbar hand button. |
  | Zoom | **Ctrl+wheel** or pinch (anchored at cursor), **Ctrl+= / Ctrl+-**, **Ctrl+0** = 100%, **Shift+1** fit page, **Shift+2** fit width |
  | Edit | **Esc** deselect, then return to the previous ink tool. **Delete/Backspace** delete. **Ctrl+D** duplicate, **Ctrl+G / Ctrl+Shift+G** group/ungroup, **Ctrl+[ / ]** order. Arrow keys nudge 1px, Shift+arrow nudges 10px. **Alt+drag** duplicates. **Shift+drag** constrains aspect/angle. **Alt+hover** shows distances. |
  | Pages | **PgUp/PgDn** previous/next page, **Ctrl+G**-style "Go to page" via clicking the page counter, **Ctrl+Shift+N** new page after current |
  | Text formatting | **Ctrl+B / I / U**, **Ctrl+Shift+L / E / R** align |
  | Global | **Ctrl+Z / Ctrl+Y** (and Ctrl+Shift+Z) undo/redo, **Ctrl+\\** toggle sidebar, **F11** focus/fullscreen, **Ctrl+F** search |

  Plain wheel scrolls vertically and Shift+wheel scrolls horizontally (Windows default). Pen eraser-end and barrel button map to eraser and lasso respectively (a Journal-like convention).
- Show the shortcut in every tooltip ("Pen (P)"). Provide a Ctrl+/ shortcut sheet. Figma, Canva and Windows tooltips all do this, and it's a cheap professionalism signal.

### Gaps
- No official Canva or Figma shortcut pages were reachable. The cited shortcut lists are third-party, and Figma's zoom-to-100% binding conflicts between sources.
- GoodNotes for Windows and Microsoft Journal's official shortcut lists were not found.
