# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

**Development workflow:**
```bash
npm run dev          # Build WASM + start dev server with hot reload at localhost:8080
npm run wasm-build   # Build only WebAssembly module (when only Rust changes)
npm run build        # Production build (outputs to dist/)
npm run preview      # Build and serve production version locally
```

**Testing:**
```bash
npm test             # Run all tests (Jest + Rust unit tests)
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run with coverage report
cargo test           # Run only Rust unit tests
```

**Running single test file:**
```bash
npm test -- tests/ui-integration.test.js
npm test -- --testNamePattern="specific test name"
```

## Architecture Overview

This is a **hybrid Rust/WebAssembly + JavaScript** image processing application with a clear separation of concerns:

### Core Architecture Pattern
- **Rust/WASM Backend** (`src/lib.rs`): High-performance image processing using the `image` crate
- **JavaScript Frontend** (`www/`): Modern ES6 modules for UI coordination and DOM management  
- **WebAssembly Bridge**: `wasm-bindgen` provides seamless Rust-JS interop with automatic memory management

### Component Interaction Flow
1. **ImageLoader** (`www/image-loader.js`) - Handles file I/O, drag-drop, and converts files to ImageHandle instances via WASM
2. **CanvasManager** (`www/canvas-manager.js`) - Manages HTML5 canvas rendering, image positioning, selection UI, grid overlay, and user interactions (click/drag)
3. **UIController** (`www/ui-controller.js`) - Orchestrates the entire application: coordinates between components, manages auto-preview logic, handles zoom/pan controls, and export functionality

### Key WASM Functions (src/lib.rs)
- `load_image_from_bytes()` - Creates ImageHandle from raw image data
- `create_tiled_image()` - Main tiling algorithm with configurable grid layouts
- `zoom_and_pan_image()` - Applies zoom/offset transformations to individual images
- `export_image_bytes()` - Converts ImageHandle to PNG/JPEG bytes for download

## Critical Implementation Details

### WASM Memory Management
- ImageHandle instances must be explicitly freed in JavaScript: `handle.free()`
- The ImageLoader maintains a registry of handles and provides cleanup methods
- Always use `try/finally` blocks when working with WASM objects

### Canvas Architecture
- CanvasManager maintains `imagePositions[]` array that maps canvas coordinates to grid tiles
- Selection state (`selectedImageIndex`) coordinates between canvas clicks and UI updates
- Grid overlay is drawn on canvas but excluded from exports (exports use original WASM image bytes)

### Auto-Preview Logic
UIController implements automatic grid layout selection:
- 1 image → 1x2 layout (with blank space)
- 2 images → 1x2 side-by-side
- 3 images → 2x2 with one blank
- 4+ images → optimal rectangular grid

### Testing Strategy
- **WASM Integration Tests** (`tests/wasm-integration.test.js`) - Test Rust functions via WebAssembly
- **Component Tests** - Individual JavaScript module testing with mocked dependencies
- **UI Integration Tests** (`tests/ui-integration.test.js`) - End-to-end workflows including export functionality
- **DOM Setup** (`tests/setup.js`) - Provides HTML fixtures for component testing

### Export Functionality
Exports use the original WASM image bytes (not canvas content) to ensure:
- No quality loss from canvas rendering
- Grid overlays and UI elements are excluded
- Supports PNG and JPEG formats with configurable quality

### Image Processing Pipeline
1. File dropped/selected → ImageLoader.loadFile()
2. Raw bytes → WASM load_image_from_bytes() → ImageHandle
3. User adjusts grid → WASM create_tiled_image() → new ImageHandle
4. Individual image zoom/pan → WASM zoom_and_pan_image() → modified ImageHandle
5. Export → WASM export_image_bytes() → download trigger

## Development Patterns

### Adding New WASM Functions
1. Add function to `src/lib.rs` with `#[wasm_bindgen]` attribute
2. Build WASM: `npm run wasm-build`
3. Import in JavaScript: `import { newFunction } from '../pkg/image_tiler.js'`
4. Add corresponding tests in `tests/wasm-integration.test.js`

### Adding UI Features
1. Add HTML structure in `www/index.html`
2. Add element reference in `UIController.initializeElements()`
3. Add event listeners in `UIController.setupEventListeners()` 
4. For canvas interactions, modify `CanvasManager` methods
5. Update tests to handle new DOM elements (check for existence with optional chaining)

### Grid Overlay System
- `CanvasManager.gridState`: 0=off, 1=thirds, 2=fifths
- `drawGrid()` draws white semi-transparent lines over each tile
- Grid is redrawn on every `redrawWithSelection()` call
- Button state management in `UIController.toggleGrid()`

## Git and GitHub Workflow

### Git Rules
- **Never commit unless explicitly asked to** - Always wait for user permission before making commits
- Run all tests (`npm test`) before committing to ensure no regressions
- Use descriptive commit messages that explain both what and why
- Include `Closes #X` in commit messages when fixing GitHub issues

### GitHub Integration
- **GitHub CLI available**: Use `gh` tool to view and manage GitHub issues
- **View issues**: `gh issue view <number>` to see issue details
- **List issues**: `gh issue list` to see all open issues
- **Create sub-issues**: Use GitHub GraphQL API through `gh api graphql` to link sub-issues to parent issues

Example GraphQL mutation for creating linked sub-issues:
```bash
gh api graphql -f query='
mutation {
  createIssue(input: {
    repositoryId: "REPO_ID"
    title: "Sub-issue title"
    body: "Sub-issue description\n\nParent: #PARENT_ISSUE_NUMBER"
  }) {
    issue {
      number
    }
  }
}'
```

## Testing Requirements

All tests must pass before committing changes. The test suite includes:
- WASM function validation
- UI component integration  
- Export functionality verification
- Grid layout algorithms
- Image selection and manipulation workflows

When adding features that modify existing components, ensure test compatibility by checking for element existence before accessing (especially for UIController DOM elements).