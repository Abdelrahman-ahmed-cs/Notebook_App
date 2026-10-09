# Handwriting-first digital notebook apps: feature inventory (GoodNotes 6, Notability, Noteshelf 3, Samsung Notes, CollaNote, ZoomNotes, Nebo/MyScript Notes, OneNote inking)

Method note: direct page fetching (goodnotes.com, notability.com, noteshelf.net, support.goodnotes.com, learn.microsoft.com) was blocked by the sandbox egress policy, so findings come from web-search result summaries of official help-center pages, app-store listings, vendor blogs and 2024–2026 reviews. Every cited claim below links to the page the search surfaced. Claims I could not verify are listed under Gaps, or marked "[unverified]" in the Inferences matrix.

## Q1. What does each app's lasso tool support (move, resize, recolor, convert to text, screenshot, copy/paste)?

### Takeaway
Every leader's lasso does select, move, resize and delete, plus cut/copy/paste. The standard set on top of that is recolor, rotate, convert-to-text and screenshot (GoodNotes, Noteshelf 3), with filters for which object types to select (GoodNotes, Noteshelf 3) and both freeform and rectangle lasso modes (GoodNotes, CollaNote). A common user complaint is that a selection can't be moved across pages. GoodNotes 6 now reportedly supports that and Notability does not.

### Cited Findings
**GoodNotes 6**
- The lasso selects GoodNotes-created content (handwriting, highlights, text boxes, images). Actions: move, cut/copy/paste, drag-and-drop, resize, rotate, delete, change color, convert handwriting to text, take a screenshot, and "add to Elements" (save the selection as a reusable sticker/element). — [GoodNotes support: Select content for copying, moving](https://support.goodnotes.com/hc/en-us/articles/360000629656--GoodNotes-5-Select-content-for-copying-moving-etc-); [GoodNotes Notion help: Lasso Tool](https://goodnotes-team.notion.site/Lasso-Tool-26fb740273d281008fc5edc2539b2b7b)
- The lasso is freeform by default with a switchable rectangular mode. Tapping the lasso twice opens selection filters (e.g., Handwriting, Images, Text). If only "Take Screenshot" appears, the filters exclude the content. — [GoodNotes support](https://support.goodnotes.com/hc/en-us/articles/360001460175)
- The lasso selects only annotations, not the underlying PDF text. The workaround is to screenshot the PDF text and paste it. — [GoodNotes support](https://support.goodnotes.com/hc/en-us/articles/360001460175)
- Older help pages said selections can't be moved across page boundaries. Users have asked for cross-page drag, lasso in the zoom window, and rotate/resize without the popup. — [GoodNotes feedback: lasso improvements](https://feedback.goodnotes.com/forums/191274-customer-suggestions-for-goodnotes/suggestions/37681576-lasso-tool-improvements); [Lasso in zoom window request](https://feedback.goodnotes.com/forums/191274-customer-suggestions-for-goodnotes/suggestions/17153801-lasso-available-in-zoom-window). A 2026 comparison now says "Goodnotes 6 can move items across pages", in contrast to Notability. — [Affine: Goodnotes 6 vs Notability 2026](https://affine.pro/blog/goodnotes-vs-notability-tips) (conflict: older help vs newer review)
- After a single use, the Elements and Shapes tools revert to the Lasso tool. The lasso is one of the "sticky" tools. — [GoodNotes support: Improved User Interface](https://support.goodnotes.com/hc/en-us/articles/13682253498767-Improved-User-Interface)

**Notability**
- The lasso selects, moves and resizes handwritten content. Selected items can only be moved to another spot on the same page. — [Paperlike: Goodnotes vs Notability 2026](https://paperlike.com/blogs/paperlikers-insights/app-review-goodnotes-vs-notability); [Affine 2026](https://affine.pro/blog/goodnotes-vs-notability-tips)

**Noteshelf 3**
- The lasso can select handwriting, text boxes, photos or shapes, alone or in any combination (type filter). Selections can't be moved across pages in the same notebook. — [Paperless X: Noteshelf 3 complete review](https://beingpaperless.com/noteshelf-3-for-the-ipad-complete-review/)
- The lasso reshapes, resizes and moves content, and converts handwriting to text. — [Paperlike: Noteshelf 3 Review (2026)](https://paperlike.com/blogs/paperlikers-insights/noteshelf-review)
- Convert-to-text flow: tap the lasso, select the handwriting, then "Convert To Text". — [Noteshelf support: search handwriting & convert to text](https://noteshelf-support.fluidtouch.biz/hc/en-us/articles/360046856373-How-to-search-handwriting-convert-to-text); [Noteshelf support: Handwriting to Text (OCR)](https://noteshelf-support.fluidtouch.biz/hc/en-us/articles/14273189697817-How-to-use-Handwriting-to-Text-OCR-Feature)
- The lasso can also take screenshots and delete items. — [search-summary of Noteshelf listings](https://apps.apple.com/us/app/noteshelf-3-ai-digital-notes/id6458735203)

**CollaNote**
- Offers a freehand lasso and a rectangular lasso. A recent version added flipping the selection horizontally or vertically. — [July Baby Studio: CollaNote review](https://www.julybabystudio.com/post/collanote-key-features-and-review); [Paperless X: CollaNote 2024](https://beingpaperless.com/collanote-for-ipad-pt-2-everything-you-can-add-to-your-notes-2024/)

**Samsung Notes**
- A "dotted lasso" works as the selection tool. — [Samsung Business Insights: 10 tips (Mar 2025)](https://insights.samsung.com/2025/03/27/10-tips-for-increased-productivity-with-samsung-notes/)

**OneNote**
- Lasso Select picks up every ink stroke inside a freeform outline. Ink to Text, Straighten and other ink commands then act on the selection. — [Microsoft Support: Drawing tools](https://support.microsoft.com/en-us/onenote/onenote-help-and-learning/learn-more-about-drawing-tools); [Microsoft Support: Ink to Text](https://support.microsoft.com/en-us/onenote/onenote-help-and-learning/explore-the-ink-to-text-pen)
- Handwriting straightening (2024, Beta channel first): select the ink by tapping a line or with Lasso Select, then choose Straighten. It cleans up slanted writing without converting it to text. It does not work on single words, formulas, tables, images, highlighter or underlines, and supports Latin-alphabet languages only. — [Microsoft 365 Insider blog](https://techcommunity.microsoft.com/blog/microsoft365insiderblog/enhance-your-inking-with-handwriting-straightening-in-onenote-on-windows/4225103); [How-To Geek](https://www.howtogeek.com/onenote-for-windows-can-now-straighten-your-handwriting/)

**Nebo / MyScript Notes**
- Instead of relying mainly on a lasso, Nebo uses gestures on "blocks": scratch-out erases, an underline toggles bold, a box around text highlights it, and a vertical down-stroke inserts a line break. Each block (text paragraph, diagram, math) is edited on its own. — [MacStories: Nebo review](https://www.macstories.net/reviews/nebos-handwriting-recognition-elevates-your-notes/); [MyScript Notes help (iOS)](https://help.myscript.com/notes/versions/ios/)

### Inferences
- The baseline lasso feature set a new app needs: freeform and rectangle modes; a type filter (ink / text / image / shape); move, resize, rotate, delete; cut, copy, paste and duplicate; recolor ink; convert to text (OCR); screenshot the region to an image/clipboard; save the selection as a reusable element/sticker; flip H/V (CollaNote). Moving a selection to another page (drag onto a thumbnail, or cut/paste) differentiates GoodNotes from Notability and Noteshelf.
- Fabric.js maps directly onto most of these: `ActiveSelection` gives move/resize/rotate/flip, and lasso hit-testing can be built with a polygon containment test on path points. A screenshot is `canvas.toDataURL` on a clipped region. Every lasso action works fully offline. Convert-to-text needs an offline handwriting recognizer (see Q5).
- OneNote's "Straighten" and Nebo's gesture editing are rarer, advanced options.

### Gaps
- I could not confirm from an official 2025–2026 GoodNotes page whether cross-page lasso move has shipped. The sources conflict (old help pages vs a 2026 review).
- No source detailed Samsung Notes' lasso actions (recolor, convert, etc.) or ZoomNotes' selection tools.
- I found no source on whether Notability's lasso recolors or converts to text, though both are widely reported. [unverified]

## Q2. What pen / eraser / highlighter options are exposed?

### Takeaway
GoodNotes has the most granular eraser: three styles (Stroke, Standard, Precision), an Erase Filter by stroke type (pen, highlighter, pencil, tape), Auto-Deselect, and Scribble-to-Erase. Pen type variety is widest in CollaNote ("25+ pens and brushes"), ZoomNotes (8 pen kinds including watercolour and italic), and Samsung/OneNote (fountain, brush, pencil). GoodNotes and Noteshelf offer highlighter-only erasing. Stroke stabilization/smoothing, shape snapping and a ruler are common.

### Cited Findings
**GoodNotes 6**
- Eraser styles: **Stroke Eraser** removes a whole continuous stroke, **Standard Eraser** removes a segment of a stroke, and **Precision Eraser** removes only what lies inside the eraser circle. — [GoodNotes support: Erase content with the Eraser tool](https://support.goodnotes.com/hc/en-us/articles/7353718249231-Erase-content-with-the-Eraser-tool)
- **Erase Filter**: choose which stroke types the eraser affects. For example, enabling Highlighter and disabling Pen, Pencil and Tape erases only highlighting. — [GoodNotes support](https://support.goodnotes.com/hc/en-us/articles/7353718249231-Erase-handwriting-and-page-content-with-the-Eraser-tool)
- **Auto-Deselect**: the eraser switches back to the last-used tool when the stylus is lifted. — [GoodNotes support](https://support.goodnotes.com/hc/en-us/articles/7353718249231-Erase-content)
- **Scribble to Erase**: scribbling over handwriting erases it. — [GoodNotes support: How to Use Scribble to Erase](https://support.goodnotes.com/hc/en-us/articles/7443501398671-How-to-Use-Scribble-to-Erase)
- Writing tools: Pen, Highlighter, Pencil. Sticky tools are Lasso, Pen/Highlighter/Pencil, Eraser, Tape and Laser Pointer. Non-sticky tools (return to the lasso after one use) are Images, Elements, Shapes, Sticky Notes and Textbox. — [GoodNotes support: Improved User Interface](https://support.goodnotes.com/hc/en-us/articles/13682253498767-Improved-User-Interface)
- **Tape tool**: thickness slider, solid colors and patterns. Tape covers content, like study flashcards, and is tapped to reveal. — [Paperless X: Goodnotes 6 review](https://beingpaperless.com/goodnotes/) (the reveal mechanic is my characterization; the review covers the styling)
- **Laser Pointer** at the far right of the toolbar draws a temporary highlight to direct attention. — [GoodNotes support: Focus Attention with Laser Pointer](https://support.goodnotes.com/hc/en-us/articles/7451632333327-Focus-Attention-with-Laser-Pointer)
- **Shape tool** snaps hand-drawn shapes into perfect shapes. A **ruler** measures in cm or inches. — [Paperless X: Goodnotes 6 review](https://beingpaperless.com/goodnotes/)
- The highlighter can be "straightened out to look neat" (a straight-line highlighter). — [Paperless X: Goodnotes 6 review](https://beingpaperless.com/goodnotes/)
- **Stroke stabilization** for handwriting arrived in the Q1 2025 update. — [GoodNotes blog: Jan–Mar 2025](https://www.goodnotes.com/blog/features-fixes-updates-march-2025)
- Pen favorites: a "Using Bookmarks and Favorite Items" help article exists, but its content was not retrieved. One 2024 review says "we're still waiting for a favourites toolbar"; another review says favorites are reachable from the sidebar. — [GoodNotes support index](https://support.goodnotes.com/hc/en-us/articles/9963352849167-Why-certain-tools-seem-to-be-missing); [Paperless X](https://beingpaperless.com/goodnotes/) (conflicting)
- An "AI-powered eraser that can remove entire handwritten words with a single tap" was attributed to GoodNotes 6 by a third-party review. — [ClickUp DE: Goodnotes vs Notability](https://clickup.com/de/blog/156125/goodnotes-vs-notability) (low-confidence source)

**Noteshelf 3**
- The eraser offers stroke-based and highlighter-only erasing, among other options. — [Paperlike: Noteshelf 3 Review (2026)](https://paperlike.com/blogs/paperlikers-insights/noteshelf-review)
- Pens and highlighters; strokes can be turned into clean shapes, and geometric shapes are available for flowcharts. — [App Store: Noteshelf 3](https://apps.apple.com/eg/app/noteshelf-3/id6458735203?l=ar)
- **Zoom box**: a magnified writing area with its own toolbar and auto-advance. — [Paperlike](https://paperlike.com/blogs/paperlikers-insights/noteshelf-review); [Paperless X](https://beingpaperless.com/noteshelf-3-for-the-ipad-complete-review/)

**Samsung Notes**
- The pen menu has pens, fountain pens, pencils and highlighters, each with adjustable color and thickness. — [Google Play: Samsung Notes](https://play.google.com/store/apps/details?id=com.samsung.android.app.notes&hl=en_US)
- Highlighter, eraser and dotted lasso. — [Samsung Business Insights 2025](https://insights.samsung.com/2025/03/27/10-tips-for-increased-productivity-with-samsung-notes/)

**CollaNote**
- The App Store lists "over 25 different pens and brushes". An older review says the app has only one pen tool (ballpoint). — [App Store: CollaNote](https://apps.apple.com/us/app/collanote-notes-pdf-markup/id1540956268); [Paperless X 2022 review](https://beingpaperless.com/collanote-new-kid-on-the-block/) (conflicting; the App Store is current)
- 15 laser pointers in three sizes. — [July Baby Studio](https://www.julybabystudio.com/post/collanote-key-features-and-review)

**ZoomNotes**
- Eight pens (including gel, nib, italic, watercolour and pencil) and unlimited line thicknesses. — [ZoomNotes features page](http://www.zoom-notes.com/?page_id=71); [App Store: ZoomNotes](https://apps.apple.com/us/app/zoomnotes/id462234530)

**OneNote (Windows)**
- Pen thickness and color settings, plus effect pens (galaxy/rainbow, etc.). Ruler for straight lines at any angle (Windows only). — [Microsoft Support: Drawing tools](https://support.microsoft.com/en-us/onenote/onenote-help-and-learning/learn-more-about-drawing-tools)
- **Ink to Shape** turns rough strokes into clean shapes. Ink to Math converts handwriting to equations. — [Microsoft Support: Convert your Ink to Shapes and Math](https://support.microsoft.com/en-us/onenote/convert-your-ink-to-shapes-and-math-equations)
- **Ink to Text pen** converts as you write. It requires Windows 11 23H2 with KB5031455. — [Microsoft Support: Explore the Ink to Text Pen](https://support.microsoft.com/en-us/onenote/onenote-help-and-learning/explore-the-ink-to-text-pen)
- A 2025 roundup lists Fountain and Brush pens and an Ink Eyedropper among the year's additions. — [HubSite365: 5 new OneNote features 2025](https://www.hubsite365.com/en-ww/crm-pages/5-new-features-in-microsoft-onenote-for-2025-c69e0cb0-b20b-4412-80cf-b16afe7b4586.htm) (aggregator, moderate confidence)

**Nebo / MyScript Notes**
- Gesture-first editing (scratch-out to erase). Hold the pen after drawing a shape to regularize it. — [MyScript Notes help](https://help.myscript.com/notes/versions/ios/); [MacStories](https://www.macstories.net/reviews/nebos-handwriting-recognition-elevates-your-notes/)

### Inferences
Checklist of pen/eraser features for the Windows app, all feasible offline with Pointer Events (`pressure`, `tiltX/Y`, `pointerType === 'pen'`, eraser button detection via `buttons & 32`):
- Pen types: ballpoint (uniform width), fountain (pressure- and velocity-variable width), brush (pressure plus taper), pencil (textured, translucent), highlighter (translucent, multiply blend, drawn under the ink layer), and optionally calligraphy/italic (angle-dependent width), watercolour and marker.
- Per-pen settings: color, width, opacity, pressure sensitivity on/off, smoothing/stabilization level (GoodNotes added this in 2025), and "draw and hold to snap shape" (GoodNotes, Nebo, Noteshelf, OneNote, Samsung).
- Highlighter extras: straight-line highlighter (snap to horizontal), always behind ink.
- Pen favorites/presets: a row of saved pen+color+width combos (GoodNotes favorites; a common user request).
- Eraser modes: stroke (whole object), partial/standard (split the path), precision/pixel (cut by circle geometry). Also an erase filter by type (ink, highlighter, tape), highlighter-only erase, auto-deselect back to the previous tool, scribble-to-erase gesture, and stylus eraser-end support.
- Tape tool (cover/reveal blocks for study), laser pointer (fading trail, presentation), ruler (rotatable straightedge, with a protractor as an option).

### Gaps
- No primary source detailed Notability's eraser modes or pen types for 2025–2026. (Commonly reported: pen, highlighter, and partial/whole-stroke erasers. [unverified])
- GoodNotes' pen-favorites UI and how the straight-line highlighter works (hold-to-straighten vs a toggle) were not confirmed from an official page.
- I found no data on pressure-curve customization in any app.

## Q3. What page/paper templates and page management features exist (thumbnails, drag reorder, insert from template, bookmarks, outline, hyperlinks)?

### Takeaway
GoodNotes sets the reference: a sidebar with a Pages tab (thumbnail grid, drag reorder, multi-select "Select Pages") and a Bookmarks filter. It also has an Outline tab (imported PDF outlines plus custom ones), page-level undo/redo (2025), change-template-per-page, hyperlinks preserved on export, and a template marketplace. Noteshelf leads on covers and planners/diaries (200+ templates, cover packs, configurable diaries). Notability offers a template gallery plus "My Templates". ZoomNotes adds layers, master layers and saved "bookmark views".

### Cited Findings
- **GoodNotes sidebar**: the Pages tab shows thumbnails, and pages drag to new positions. "All Pages > Bookmarks Only" filters to bookmarked pages. The Outline tab jumps to and manages outline items; imported PDF outlines appear alongside custom ones, with custom ones in bold. — [GoodNotes support: Use the Sidebar](https://support.goodnotes.com/hc/en-us/articles/9497798035983-Use-the-Sidebar-to-navigate-your-document)
- **GoodNotes reorder / multi-page**: the "Select Pages" command moves several pages at once. A Document View manages pages. — [GoodNotes support: Reorder Pages](https://support.goodnotes.com/hc/en-us/articles/7353718659343-Reordering-pages-in-a-document); [Manage pages in Document View](https://support.goodnotes.com/hc/en-us/articles/5898537788815-Manage-pages-in-Document-View)
- **GoodNotes change template**: the page template can be changed per page. If the new template's size or orientation differs, content may be hidden. The June 2025 release added undo/redo for page actions (add, delete, rotate, reorder, change template). — [GoodNotes blog: Apr–Jun 2025](https://www.goodnotes.com/blog/features-fixes-updates-june-2025); [GoodNotes support: Use the Sidebar](https://support.goodnotes.com/hc/en-us/articles/9497798035983-Use-the-Sidebar-to-navigate-your-document)
- **GoodNotes hyperlinks / outlines on export**: export as Goodnotes document, PDF (editable or flattened) or image. The Editable PDF data format keeps hyperlinks and outlines. The June 2025 notes say hyperlinks created in Goodnotes are preserved in editable PDF export. — [GoodNotes support: Export documents or pages](https://support.goodnotes.com/hc/en-us/articles/7353742824975-Export-documents-or-pages); [PDF outlines and hyperlinks missing on export](https://support.goodnotes.com/hc/en-us/articles/360000630515-PDF-outlines-and-hyperlinks-are-missing-when-I-export-a-document)
- **GoodNotes "Dynamic Templates"** (e.g., auto-generated planner pages) launched with Goodnotes 6, along with a **Marketplace** for templates, stickers and planners. — [GoodNotes blog: Introducing Goodnotes 6](https://www.goodnotes.com/blog/introducing-goodnotes-6); [Goodnotes Marketplace](https://marketplace.goodnotes.com/product/64e37b0651ed3d429cee6c8d)
- **GoodNotes 2025 document types**: Notebooks, **Whiteboards** (infinite canvas), **Text Documents**, Templates. — [GoodNotes blog: Jul–Sep 2025](https://www.goodnotes.com/blog/features-fixes-updates-september-2025); [GoodNotes for Windows page](https://www.goodnotes.com/de/windows)
- **Notability**: paper templates come in plain, ruled, squared or dotted. The background can be changed, or a template added, from the gallery or "My Templates". Reviews say Notability has more built-in templates than GoodNotes. — [Colorado College Notability Quick Start (Apr 2025)](https://www.coloradocollege.edu/offices/accessibilityresources/images/quickstartguides/Notability%20Quick%20Start%20Guide.pdf); [Paperlike 2026](https://paperlike.com/blogs/paperlikers-insights/app-review-goodnotes-vs-notability)
- **Noteshelf 3**: "200+ exclusive templates" for planners and journals; a Covers section in Templates with downloadable cover packs; configurable digital diaries/journals; a 2026 diary-making update with planner page options and new covers. — [App Store: Noteshelf 3](https://apps.apple.com/us/app/noteshelf-3-ai-digital-notes/id6458735203); [Brandenbodendorfer: Noteshelf 3 Digital Planner 2026](https://brandenbodendorfer.com/noteshelf-3-digital-planner/)
- **Noteshelf**: customizable paper and covers. — [Paperlike: Noteshelf review](https://paperlike.com/blogs/paperlikers-insights/noteshelf-review)
- **ZoomNotes**: layers control what's visible on a page, and "master layers" show on all pages. Bookmarks save views (position plus zoom) for returning later. Infinite whiteboard mode with near-infinite zoom, including rotated views. — [ZoomNotes features page](http://www.zoom-notes.com/?page_id=71); [App Store: ZoomNotes Desktop](https://apps.apple.com/us/app/zoomnotes-desktop/id986761220?mt=12)
- **Nebo**: freeform pages plus structured "blocks" (text, diagram, math, sketch, image) that reflow as width changes. — [MacStories](https://www.macstories.net/reviews/nebos-handwriting-recognition-elevates-your-notes/); [MyScript Notes](https://www.myscript.com/notes/)

### Inferences
Page-management checklist for the Windows app:
- Notebook creation: choose cover (solid, image or pack), paper template (blank, ruled narrow/wide, grid, dot, Cornell, music staff, planner), color (white/yellow/dark), page size (A4, A5, Letter, Legal, custom, landscape/portrait), and infinite/whiteboard pages.
- Sidebar: thumbnail grid with drag-to-reorder, multi-select (move/duplicate/delete/rotate/export selected), insert page before/after from any template, change template on existing pages, duplicate page, bookmark page (with a filter), and an outline/TOC panel that imports PDF outlines and lets users add custom entries.
- Internal hyperlinks (link selection → page N or URL), preserved in PDF export as link annotations.
- Page-level undo/redo (GoodNotes added it only in 2025, so it is a quality marker).
- Layers / master layers (ZoomNotes) are niche but cheap in Fabric (object groups with visibility).
- Templates can be bundled as PDFs/SVGs. Rendering and storing them is fully offline.

### Gaps
- No source listed GoodNotes' or Notability's exact paper sizes or template counts.
- Samsung Notes page templates/backgrounds and CollaNote's template set were not covered by the sources found.
- Whether Notability supports internal page hyperlinks or an outline was not found.

## Q4. Which features are standout differentiators per app?

### Takeaway
GoodNotes: breadth plus polish (Elements, handwriting search/OCR, spellcheck in handwriting, Ask Goodnotes AI, whiteboards and text docs, marketplace, Windows/Android/web reach). Notability: audio recording synced to ink with replay, plus transcripts and "Learn" AI study tools. Noteshelf 3: covers/diaries/stickers and Zoom Box. Samsung Notes: audio-synced writing plus Galaxy AI Note Assist. CollaNote: free real-time collaboration and many pens and laser pointers. ZoomNotes: near-infinite zoom, layers and animated playback. Nebo: best-in-class ink-to-text, editable diagrams and math with reflow. OneNote: Ink Replay, Ink to Shape/Math/Text, Straighten, ruler, deep Windows integration.

### Cited Findings
**GoodNotes 6**
- AI spellcheck in handwriting (English, Spanish, German, Dutch) runs on-device on the Apple neural engine. Word Complete was discontinued on March 31, 2025. AI Math Assistance / Math Assist recognizes equations and offers quick calculations. Ask Goodnotes answers questions from your notes and generates quizzes. — [GoodNotes blog: Introducing Goodnotes 6](https://www.goodnotes.com/blog/introducing-goodnotes-6); [MacRumors](https://www.macrumors.com/2023/08/09/goodnotes-6-ai-powered-handwriting-spellcheck/); [PR Newswire 2024](https://www.prnewswire.com/news-releases/goodnotes-elevates-productivity-for-its-24m-users-with-new-ai-powered-enhancements-302267107.html)
- Q1 2025 added stroke stabilization, Ask Goodnotes diagram generation, and audio summaries (some AI tools are Apple-only). Q3 2025 added Whiteboards, Text Documents, automated note-taking and Goodnotes AI. — [GoodNotes blog Jan–Mar 2025](https://www.goodnotes.com/blog/features-fixes-updates-march-2025); [GoodNotes blog Jul–Sep 2025](https://www.goodnotes.com/blog/features-fixes-updates-september-2025)
- The Windows page lists Notebooks, Whiteboards, Text Documents, Templates, Handwriting Search, Handwriting to Text, Real-Time Collaboration, iCloud Sync and Goodnotes AI. — [GoodNotes for Windows](https://www.goodnotes.com/de/windows)
- Elements behave like Messages stickers. Stickers can be bought in the shop, imported, or made by the user (lasso → add to Elements). — [Paperless X: Goodnotes 6 review](https://beingpaperless.com/goodnotes/)
- "Smart Ink" is named among the impactful AI features. — [GoodNotes blog Jan–Mar 2025](https://www.goodnotes.com/blog/features-fixes-updates-march-2025)

**Notability**
- Audio syncs to notes as you write. Tapping ink jumps playback to that moment, and Note Replay animates notes during playback. Transcripts are generated after recording. — [Paperlike 2026](https://paperlike.com/blogs/paperlikers-insights/app-review-goodnotes-vs-notability); [Colorado College guide 2025](https://www.coloradocollege.edu/offices/accessibilityresources/images/quickstartguides/Notability%20Quick%20Start%20Guide.pdf); [MDS Tech overview](https://tech.mountdesales.net/?p=1540)
- Notability Learn (AI) builds summaries, quizzes, flashcards and fill-in-the-blanks from notes, PDFs or recordings. It is for Plus/Pro only and not available on MDM devices. — [Notability support: Notability Learn](https://support.gingerlabs.com/hc/en-us/articles/8073483239834-Notability-Learn); [Notability blog: Introducing Learn](https://blog.notability.com/post/introducing-notability-learn)
- Presentation mode (when mirroring or on HDMI) supports drawing, typing and zoom, and has a laser pointer. — [Notability support: Tips for online learning](https://support.gingerlabs.com/hc/en-us/articles/360040604772-Tips-for-Online-Learning-with-Notability)

**Noteshelf 3**
- Audio recording while taking notes, with real-time text conversion of recordings added later. A 2023 review complained that recordings don't sync with the ink. Also Noteshelf AI, emoji/stickers, Unsplash/Pixabay image libraries, and presentation to an external display with a laser pointer and markers. — [App Store: Noteshelf 3](https://apps.apple.com/us/app/noteshelf-3-ai-digital-notes/id6458735203); [Paperless X](https://beingpaperless.com/noteshelf-3-for-the-ipad-complete-review/); [Noteshelf Android page](https://www.noteshelf.net/noteshelf3-android.html); [Samsung Galaxy Store listing](https://galaxystore.samsung.com/detail/com.fluidtouch.noteshelf3)

**Samsung Notes**
- Voice recordings inserted through the paperclip menu; "your writing will automatically sync to the audio". Transcript Assist transcribes recordings. — [Samsung Support: Notes features](https://www.samsung.com/us/support/answer/ANS10001384/); [Samsung Support: Voice Recorder with Galaxy AI](https://www.samsung.com/us/support/answer/ANS10000942/)
- Note Assist (Galaxy AI) fixes spelling and formatting, summarizes, translates, and auto-formats into headers/bullets or meeting notes. It needs One UI 6.1+, a Samsung account, internet, and 200–4,000 characters. — [Samsung Support](https://www.samsung.com/us/support/answer/ANS10001384/)
- PDF import and annotation; Audio Bookmark since One UI 2.5. — [Wikipedia: Samsung Notes](https://en.wikipedia.org/wiki/Samsung_Notes)

**CollaNote**
- Real-time collaboration with invites by email or nickname, reportedly with unlimited participants. Free or near-free pricing (sources conflict). — [App Store: CollaNote](https://apps.apple.com/us/app/collanote-notes-pdf-markup/id1540956268); [Medium: CollaNote, a truly free note-taking app](https://medium.com/macoclock/collanote-a-truly-free-note-taking-app-39752b47dbe5); [July Baby Studio](https://www.julybabystudio.com/post/collanote-key-features-and-review)

**ZoomNotes**
- Zoom with no set limits (near-infinite), an infinite whiteboard, layers and master layers, saved view bookmarks, animated playback to build presentations or export video, and VGA/AirPlay projector support. — [ZoomNotes features](http://www.zoom-notes.com/?page_id=71); [App Store: ZoomNotes Desktop](https://apps.apple.com/us/app/zoomnotes-desktop/id986761220?mt=12)

**Nebo / MyScript Notes** (renamed from Nebo to "MyScript Notes")
- Ink-to-text praised as roughly 90%+ accurate. Handwriting reflows when the width or orientation changes. Editable diagrams (hold to regularize shapes and arrows). Math is recognized and computed. Pro adds unlimited notebooks, PDF import, and export to HTML/PDF/LaTeX. — [MyScript Notes](https://www.myscript.com/notes/); [Paperlike: MyScript Notes review](https://paperlike.com/blogs/paperlikers-insights/myscript-notes-app-review); [MacStories](https://www.macstories.net/reviews/nebos-handwriting-recognition-elevates-your-notes/)

**OneNote**
- Ink Replay plays strokes back in drawing order (Windows only, in OneNote/Word/Excel/PowerPoint for M365). Ink to Shape, Ink to Math, the Ink to Text pen, Straighten, and a ruler. — [Microsoft Support: Ink Replay](https://support.microsoft.com/en-us/onenote/onenote-help-and-learning/ink-replay); [Microsoft Support: Ink to Shapes/Math](https://support.microsoft.com/en-us/onenote/convert-your-ink-to-shapes-and-math-equations); [Microsoft 365 Insider blog: Straighten](https://techcommunity.microsoft.com/blog/microsoft365insiderblog/enhance-your-inking-with-handwriting-straightening-in-onenote-on-windows/4225103)
- OneNote for Windows 10 reached end of support in October 2025. The Microsoft 365 OneNote app is current. — [Microsoft Support (search summary)](https://support.microsoft.com/en-us/office/replay-ink-strokes-in-onenote-for-windows-10-cbc9188a-75a3-4f06-9a9e-6410b658b4e3)

### Inferences
Standout-differentiator summary (U = unique or near-unique):
| App | Differentiators |
|---|---|
| GoodNotes 6 | Elements (lasso → reusable sticker) **U-ish**; three eraser styles plus erase filter plus auto-deselect; handwriting search and spellcheck **U** (spellcheck); outline tab including custom outlines; marketplace; whiteboards + text docs; widest platform reach |
| Notability | Audio synced to ink with tap-to-seek and Note Replay **U** (Samsung is closest); transcripts; Learn AI study tools |
| Noteshelf 3 | Covers/diary builder, 200+ templates, Zoom Box with auto-advance, stickers/emoji and stock photo libraries |
| Samsung Notes | Audio-synced handwriting (Audio Bookmark); Galaxy AI Note Assist; free; S Pen integration |
| CollaNote | Free real-time collaboration **U**; 25+ pens/brushes; 15 laser pointers; flip selection |
| ZoomNotes | Near-infinite zoom **U**; layers/master layers **U**; animated playback/video export |
| Nebo/MyScript | Reflowable ink, gesture editing, editable diagrams, math solving, LaTeX/HTML export **U** |
| OneNote | Ink Replay **U**; Ink to Math; Straighten; free; native Windows ink; sections/tabs/page hierarchy |

### Gaps
- Detail on GoodNotes "Smart Ink" (scribble-to-erase plus spellcheck plus auto-straighten?) was not retrieved.
- CollaNote's tape tool, element library and web-search/clip features were not confirmed (no source mentioned tape).
- I found no current source on Samsung Notes tags, page templates or shape correction.

## Q5. Which features are feasible fully offline on Windows, and which apps are iPad-only vs available on Windows?

### Takeaway
On Windows natively: OneNote (full inking suite); Samsung Notes (Microsoft Store, optimized for Galaxy Books, recently reported to run on any PC); GoodNotes (Windows app); Noteshelf 3 (Windows listed, though sources conflict); Nebo (historic Windows app). Notability is web-only on Windows (Chrome). CollaNote is Apple-only. ZoomNotes has a Mac desktop app; a Windows version is reported only by third-party download sites. Almost every non-AI feature is buildable offline. The cloud-bound features are LLM summaries/quizzes and collaboration. OCR/handwriting search and transcription are feasible offline with local engines.

### Cited Findings
- GoodNotes for Windows exists. Its page lists Notebooks, Whiteboards, Text Documents, Templates, Handwriting Search, Handwriting to Text, Real-Time Collaboration and Goodnotes AI. — [GoodNotes Windows page](https://www.goodnotes.com/de/windows). Some 2025 AI tools are marked Apple-only. — [GoodNotes blog Jan–Mar 2025](https://www.goodnotes.com/blog/features-fixes-updates-march-2025)
- The Notability web app lets Windows, Linux and Android users access and edit notes in the browser (Chrome recommended), including document import/annotation, audio transcription and Learn. It is unavailable in Mainland China, Hong Kong and Macau. — [Notability blog: Notability Web is Here](https://blog.notability.com/post/notability-web-is-here)
- Noteshelf: one source lists iOS, iPadOS, macOS, watchOS, Android and Windows, with Windows priced at $4.99. Another review says Windows sync is difficult, and one listing shows iOS only. — [Paperlike](https://paperlike.com/blogs/paperlikers-insights/noteshelf-review); [Paperless X](https://beingpaperless.com/noteshelf-3-for-the-ipad-complete-review/); [UpdateStar](https://noteshelf-3.updatestar.com/) (conflicting)
- Samsung Notes on the Microsoft Store is optimized for Galaxy Books. 2025 reports say it now works on any Windows PC. A Handwriting icon converts handwriting to typed text. — [Microsoft Store: Samsung Notes](https://apps.microsoft.com/detail/9nblggh43vhv?hl=en-US&gl=US); [Android Authority](https://www.androidauthority.com/samsung-notes-windows-update-3559666/); [SammyGuru](https://sammyguru.com/samsung-notes-now-works-on-any-windows-device-galaxy-book-or-not/)
- Note Assist requires an internet connection. — [Samsung Support](https://www.samsung.com/us/support/answer/ANS10001384/)
- ZoomNotes Desktop is described as a Mac OS app on the App Store. A Windows listing appears only on third-party download sites. — [App Store: ZoomNotes Desktop](https://apps.apple.com/us/app/zoomnotes-desktop/id986761220?mt=12); [pcmacstore](https://pcmacstore.com/en/software/986761220/zoomnotes-desktop)
- Nebo had a Windows 10 app (2016 hands-on). Recent coverage is iPad-centric (MacStories calls it iPad-only for Apple Pencil). — [PCWorld: Nebo hands-on](https://www.pcworld.com/article/415987/hands-on-myscript-nebo-is-what-windows-ink-should-be.html); [MacStories](https://www.macstories.net/reviews/nebos-handwriting-recognition-elevates-your-notes/)
- OneNote Ink Replay and the Ruler are Windows-only. The Ink to Text pen needs Windows 11 23H2 + KB5031455. — [Microsoft Support: Ink Replay](https://support.microsoft.com/en-us/onenote/onenote-help-and-learning/ink-replay); [Microsoft Support: Ink to Text pen](https://support.microsoft.com/en-us/onenote/onenote-help-and-learning/explore-the-ink-to-text-pen)
- GoodNotes spellcheck runs on-device (Apple neural engine), so on-device handwriting AI is practical. — [MacRumors](https://www.macrumors.com/2023/08/09/goodnotes-6-ai-powered-handwriting-spellcheck/)
- CollaNote is distributed through the Apple App Store (iPad/iPhone/Mac). — [App Store: CollaNote](https://apps.apple.com/us/app/collanote-notes-pdf-markup/id1540956268)

### Inferences
**Feature inventory and offline feasibility for an Electron + Fabric.js Windows app.** Legend: G=GoodNotes 6, N=Notability, NS=Noteshelf 3, S=Samsung Notes, C=CollaNote, Z=ZoomNotes, M=Nebo/MyScript, O=OneNote. Apps are listed where cited above; entries marked [u] come from background knowledge and were not verified in this research.

| Category | Feature | Apps | Offline on Windows? |
|---|---|---|---|
| Notebook/pages | Covers + paper templates (blank/ruled/grid/dot/planner) | G, N, NS, S[u], C[u], Z[u], O(rule lines/grid)[u] | Yes (bundled assets) |
| | Page sizes/orientation, custom size | G[u], NS[u], Z[u] | Yes |
| | Thumbnail sidebar, drag reorder, multi-select | G, N[u], NS[u], O(page list) | Yes |
| | Insert page from template / change template | G, N | Yes |
| | Bookmarks (pages) | G, Z (view bookmarks) | Yes |
| | Outline/TOC (incl. PDF outline import) | G | Yes (pdf.js `getOutline`) |
| | Internal hyperlinks (page/URL), preserved on export | G, O[u] (page links) | Yes (pdf-lib link annots) |
| | Sections/tabs hierarchy | O[u], N (dividers)[u] | Yes |
| | Infinite canvas / whiteboard | G (Whiteboards), Z, O[u] | Yes |
| | Layers, master layers | Z | Yes |
| | Page-level undo/redo | G (2025) | Yes |
| Pen & ink | Ballpoint/fountain/brush/pencil/highlighter | S (fountain, pencil), O (fountain, brush 2025), Z (gel, nib, italic, watercolour, pencil), C (25+), G (pen, pencil, highlighter) | Yes |
| | Pressure + tilt | all [u] | Yes (PointerEvent) |
| | Stroke stabilization/smoothing | G (2025) | Yes |
| | Shape recognition (draw-and-hold) | G, NS, M, O (Ink to Shape) | Yes (heuristic fitting) |
| | Straight-line highlighter | G | Yes |
| | Pen favorites/presets | G (partially confirmed) | Yes |
| | Ruler | G, O | Yes |
| | Handwriting straighten | O | Hard (needs line segmentation) |
| | Ink Replay / stroke-order playback | O, N (Note Replay with audio) | Yes (store timestamps) |
| Eraser | Stroke / partial / precision (pixel) | G (all three) | Yes |
| | Erase filter (highlighter-only, etc.) | G, NS | Yes |
| | Auto-deselect back to previous tool | G | Yes |
| | Scribble to erase / scratch-out gesture | G, M | Yes (gesture detection) |
| Lasso | Freeform + rectangle | G, C, O (freeform) | Yes |
| | Type filter | G, NS | Yes |
| | Move/resize/rotate/delete/copy/paste | G, N, NS, C, S | Yes |
| | Recolor | G | Yes |
| | Flip H/V | C | Yes |
| | Convert to text | G, NS, O, S | Needs local HWR (see note) |
| | Screenshot of region | G, NS | Yes |
| | Save selection as element/sticker | G | Yes |
| | Move selection across pages | G (per 2026 review); not N/NS | Yes |
| Other tools | Tape (cover/reveal) | G | Yes |
| | Laser pointer | G, N, NS, C (15 types) | Yes |
| | Zoom window/box | NS, G[u] | Yes |
| | Sticky notes | G | Yes |
| Text | Text boxes, fonts, styles | G, N, NS, S, O [u for details] | Yes |
| | Lists, headings, typed doc mode | G (Text Documents), O, S (auto format) | Yes |
| | Spellcheck (typed) | all [u] | Yes (Chromium spellchecker works offline with dictionaries) |
| | Spellcheck in handwriting | G | Hard (needs HWR + synthesis) |
| Media | Images, camera/scan | all [u] | Yes (file insert; webcam via getUserMedia) |
| | Stickers/elements library | G, NS, C[u] | Yes (bundled) |
| | Stock photo search (Unsplash/Pixabay) | NS | No (online) |
| | Audio recording synced to ink + tap-to-seek | N, S, NS (recording; sync disputed) | Yes (MediaRecorder + stroke timestamps) |
| | Transcription of audio | N, S, NS | Possible offline (whisper.cpp/Vosk) |
| Organization | Folders, favorites | all [u] | Yes |
| | Typed + PDF text search | all [u] | Yes |
| | Handwriting OCR search | G, NS, O[u], S[u] | Needs local HWR |
| | Tags | S[u], O (note tags)[u] | Yes |
| Export/Import | PDF import/annotate | G, N, NS, S, C, M (Pro), O | Yes (pdf.js) |
| | Export PDF (editable vs flattened), image | G | Yes (pdf-lib) |
| | Export HTML/LaTeX/Word-like | M | Yes |
| | Native format export/backup | G | Yes (zip of JSON + assets) |
| Presentation | Presentation mode (external display, laser, draw while presenting) | N, NS, C, G (laser), Z (animated playback/video) | Yes (Electron second BrowserWindow on another display) |
| Collaboration | Real-time collaboration | C, G | No (requires network) |
| AI | Summaries/quizzes/flashcards/Q&A | N (Learn), G (Ask Goodnotes), NS (Noteshelf AI), S (Note Assist) | No for LLM-grade quality; partially with a local model |
| | Math recognition/solving | M, O (Ink to Math), G (Math Assist) | Hard offline |
| | Ink-to-text reflow, diagrams | M | Hard |

Offline handwriting recognition on Windows: Windows has a built-in ink recognizer (Windows.UI.Input.Inking `InkRecognizerContainer`) exposed through WinRT. Electron could reach it through a native addon or a NodeRT bridge. Alternatively the app could bundle an offline engine such as the MyScript iink SDK (commercial) or an ONNX handwriting model. This is the main gating dependency for lasso convert-to-text, handwriting search, and scribble/scratch-out semantics. [Inference; not researched in depth]

Priority gaps for a basic Fabric.js notebook (PDF import, text, images, shapes, pen), roughly in order of competitive impact:
1. Eraser modes (stroke/partial/precision) and the erase filter.
2. Full lasso suite (filter, recolor, screenshot, cross-page move, save as sticker).
3. Pen types with pressure, stabilization, and shape snap.
4. Page sidebar (thumbnails, reorder, insert-from-template, bookmarks, outline, hyperlinks).
5. Templates and covers library.
6. Highlighter straight-line and behind-ink rendering.
7. Tape and laser pointer.
8. Audio recording synced to strokes.
9. Presentation mode.
10. Elements/sticker library.
11. Handwriting OCR search and convert-to-text.

### Gaps
- No official Noteshelf Windows feature list was retrievable (noteshelf.net was blocked), and sources conflict on Windows availability and parity.
- I could not confirm whether the GoodNotes Windows app runs offline or what feature parity it has with iPad (the page says iCloud sync and AI; offline behavior is unknown).
- ZoomNotes' Windows availability is unconfirmed by the developer. A current Windows version of Nebo/MyScript Notes is unconfirmed.
- Accessibility features (VoiceOver/Narrator support, high contrast, dyslexia fonts, read-aloud) were not covered by any source found for these apps. This is a research gap.
- Export format lists for Notability, Noteshelf, Samsung and CollaNote were not retrieved.
- Web-clip features (e.g., CollaNote's built-in browser, OneNote Web Clipper) were not covered by the sources found.
