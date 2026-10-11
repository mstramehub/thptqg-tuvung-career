# AGENTS.md — Technical Architecture & Guidelines for AI Agents

> **Project:** Ms Trâm English Hub · Static Vocabulary Study Application  
> **Repository:** `kishikuun/thptqg-tuvung-career`  
> **Target Audience:** High-school students preparing for Vietnam National High School Graduation (THPTQG) & University Competency Assessment (ĐGNL) exams, and Ms Trâm (lead teacher).

---

## 1. Core Philosophy & Architectural Constraints

When modifying or expanding this codebase, AI agents **MUST** strictly adhere to the following rules:

1. **100% Pure Static Web Architecture:**
   - Zero build steps (no Vite, Webpack, Babel, Next.js, or bundlers).
   - Zero framework runtime (no React, Vue, or Angular; vanilla HTML5/CSS3/ES6+ only).
   - Zero external backend or server dependency.
2. **Dual-Environment Offline / Online Parity:**
   - Must run **completely offline** by double-clicking `index.html` via `file:///` on Windows/macOS/Linux.
   - Must run **flawlessly online** when hosted on GitHub Pages (`https://<user>.github.io/<repo>/`).
3. **CORS / `file:///` Safety Guardrail:**
   - **NEVER** use `fetch()`, `XMLHttpRequest`, or dynamic ES module `import()` to load local Markdown, JSON, or text files. Browsers block these under the `file://` scheme due to CORS.
   - All topic datasets are delivered as JavaScript scripts calling `window.registerTopic(\`...markdown...\`)`.
4. **Clean Design & No Clutter:**
   - Maintain modern, premium aesthetics without visual clutter.
   - Default theme is **Dark Theme** with a seamless light theme toggle.
   - Responsive across Mobile (`< 640px` with fixed bottom navigation bar), Tablet, and Desktop (keyboard shortcuts).

---

## 2. Directory Structure & Key Files

```text
thptqg-tuvung-career/
├── index.html          # Main student study application (Semantic HTML5)
├── studio.html         # Teacher Vocab Studio (Excel/Google Sheets to .js/.md converter)
├── 404.html            # Static fallback & redirect for GitHub Pages routing
├── .nojekyll           # Bypasses Jekyll on GitHub Pages (preserves all static files)
├── README.md           # User manual with teacher step-by-step guide at the top
├── AGENTS.md           # This architecture & operational guide for AI agents
├── assets/
│   └── logo.svg        # Ms Trâm English Hub brand vector logo
├── css/
│   ├── style.css       # Main app design system, theme tokens, study modes, print layout
│   └── studio.css      # Teacher Vocab Studio stylesheet
├── data/
│   └── topics/         # Topic definition files (JavaScript + Markdown)
│       ├── career.js   # Topic 1: Career Paths & Future Jobs
│       ├── career.md   # Reference Markdown file
│       ├── environment.js # Topic 2: Environment & Green Energy
│       └── environment.md # Reference Markdown file
└── js/
    ├── parser.js       # Markdown & Frontmatter parser -> structured JS objects
    ├── data.js         # Multi-topic registry & active topic state manager
    ├── app.js          # Core application logic (6 study modes, Web Audio, Web Speech)
    └── studio.js       # Teacher Vocab Studio logic (fuzzy matching & file generator)
```

---

## 3. Data Architecture: Multi-Topic & Markdown System

### 3.1 Topic Structure
Each topic file in `data/topics/<topic-id>.js` registers itself through `window.registerTopic(...)`:

```javascript
window.registerTopic(`---
id: career
title: Career Paths & Future Jobs
eyebrow: Education & Careers · B2 – C1 · Practice Test 01
desc: Ôn từ vựng trọng tâm từ các bài đọc...
passages:
  1: AI & graduate jobs
  2: Green skills
---

| Word | IPA | POS | Meaning | Passage | Example | Form | Syn | Ant | Distractors |
| obsolete | /ˌɒbsəˈliːt/ | adj | lỗi thời | 1 | None of this means that AI is destined to make young professionals ___. | obsolete | outdated | relevant | |
`);
```

### 3.2 Parser Pipeline (`js/parser.js`)
- `parseTopicMarkdown(mdText)`: Extracts YAML-style frontmatter lines between `---` fences and tabular rows between `|` characters.
- Parses columns with fuzzy header matching (`w`/`word`, `ipa`, `pos`, `vi`/`meaning`, `p`/`passage`, `ex`/`example`, `form`, `syn`, `ant`, `distractors`).
- Automatically generates distractors from synonyms, antonyms, or pool words if not explicitly supplied.
- Populates `window.TOPICS[topicId]`.

### 3.3 Topic Manager (`js/data.js`)
- Exposes `window.TopicManager`:
  - `getAll()`: Returns all registered topics.
  - `getActiveId()`: Returns active topic ID (reads from `cpv-active-topic` in `localStorage` or defaults to first topic).
  - `setActiveId(id)`: Changes active topic, saves to `localStorage`, and calls `syncActiveTopicGlobals()`.
  - `getActive()`: Returns active topic object.
- Exports globals `window.W`, `window.PASS`, `window.CLUSTERS` for backward compatibility.

---

## 4. Application Logic & Modules (`js/app.js`)

### 4.1 Study Modes (6 Tabs)
1. **`cards` (Flashcards):**
   - 3D card flip, pronunciation via Web Speech API (`en-GB`).
   - Hands-free Autoplay Slideshow (`autoplay-btn`): speaks word -> waits 2.2s -> flips -> waits 2.5s -> next card.
   - Star toggle (`⭐`) and known toggle (`✓ Đã thuộc`).
2. **`quiz` (Multiple Choice):**
   - Dynamically generated 10-question session.
   - Types: Meaning guess, Synonym, Antonym, Context identification.
   - Keyboard shortcuts: `1-4` / `A-D` to answer, `Enter`/`Space` to advance.
3. **`gap` (Fill-in-the-gap):**
   - 10 passage quote questions with blank `______`.
4. **`spell` (Spelling / Dictation):**
   - Hear pronunciation, view Vietnamese meaning, type English word into input. Immediate feedback with audio.
5. **`match` (Speed Pairs Game):**
   - 10 shuffled tiles (5 English words, 5 Vietnamese definitions).
   - Match: emerald glow + `ding` audio + hide pair. Mismatch: coral shake + `buzz` audio.
   - Stopwatch timer (`⏱️ 00:00`) with victory celebration screen.
6. **`list` (Vocabulary Directory & PDF Handout):**
   - Real-time search by English or Vietnamese.
   - Print & PDF Export (`#printListBtn`): triggers `@media print` with clean 2-column A4 handout.

### 4.2 State Persistence (`localStorage` Schema)
| Key | Type | Description |
|---|---|---|
| `cpv-theme` | `'dark' \| 'light'` | Saved UI theme (default: `'dark'`) |
| `cpv-tab` | string | Last active tab (`'cards'`, `'quiz'`, `'gap'`, `'spell'`, `'match'`, `'list'`) |
| `cpv-active-topic` | string | ID of selected topic |
| `cpv-known-${topicId}` | `string[]` (JSON) | Mastered words for specific topic |
| `cpv-weak-${topicId}` | `string[]` (JSON) | Incorrect words for specific topic (used for `🔥 Cần ôn gấp` filter) |
| `cpv-star-${topicId}` | `string[]` (JSON) | Starred words for specific topic (used for `⭐ Đã gắn sao` filter) |
| `cpv-att-${topicId}` | `{ [kind]: number }` | Attempt counters per mode |
| `cpv-student` | `{ n: string, c: string }` | Student name and class |
| `cpv-muted` | boolean | Audio effects mute state |
| `cpv-speech-rate` | number (`0.8` \| `1.0`) | Pronunciation speed |

### 4.3 Native Web Audio API (`soundFX`)
- Zero audio asset files. Synthesizes sounds via `AudioContext`:
  - `soundFX.ding()`: Dual-sine 587Hz -> 880Hz chime for correct answers.
  - `soundFX.buzz()`: Low sawtooth 180Hz buzz for wrong answers.

### 4.4 Clipboard & Contact Integration
- Clicking any element with `[data-copy]` triggers `copyToClipboard(val, label)`:
  - Writes number to clipboard.
  - Displays floating toast notification (`#toast`).
  - Plays confirmation chime.
- Standard contacts:
  - **Hotline:** `0898 123 696`
  - **Zalo:** `0792 951 529`
  - **Branch 1:** 12 Lê Đình Chinh, Quy Nhơn Nam, Gia Lai
  - **Branch 2:** 32 Chu Văn An, Quy Nhơn, Gia Lai
  - **Facebook:** `https://www.facebook.com/mstramengclass`

---

## 5. Adding New Topics (Workflow for AI Agents)

When requested to add a new topic:
1. Create `data/topics/<topic-id>.js` containing `window.registerTopic(\`...\`)` with frontmatter and markdown table.
2. (Optional) Create reference `data/topics/<topic-id>.md` for documentation.
3. Open `index.html` and append `<script src="data/topics/<topic-id>.js"></script>` before `js/data.js`.
4. Validate with `node --check js/app.js data/topics/<topic-id>.js`.

---

## 6. Testing & Quality Verification

All automated tests are Node.js-based scripts (no headless browser or external test runners needed):
```powershell
# Check JS syntax
node --check js/app.js js/data.js js/parser.js js/studio.js data/topics/career.js

# Run verification test suites
node "C:\Users\kishikuun\.gemini\antigravity-ide\brain\148516c9-3d3d-4a5d-b764-1554b8d47075\scratch\test_phase5.js"
```
Ensure 100% of links remain relative and no CORS-breaking fetch calls are introduced.
