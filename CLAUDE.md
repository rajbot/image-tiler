# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WebAssembly-based image tiler that renders dynamic patterns on an 800x800 HTML canvas with the ability to load and display images. The architecture consists of:

- **Rust WebAssembly Module** (`src/lib.rs`): Core image processing and RGBA buffer management
- **JavaScript Frontend** (`index.html`): Canvas rendering, file handling, and animation loop
- **WebAssembly Bridge**: Generated bindings in `pkg/` directory

## Build System and Commands

### Essential Commands

```bash
# Build WebAssembly module (required after any Rust changes)
wasm-pack build --target web --out-dir pkg

# Start development server for testing
python3 -m http.server 8000

# View application
# Open http://localhost:8000 in browser
```

### Development Workflow

1. Make changes to `src/lib.rs` for Rust/WASM functionality  
2. Run `wasm-pack build --target web --out-dir pkg` to regenerate bindings
3. Modify `index.html` for JavaScript/UI changes (no rebuild needed)
4. Refresh browser to test changes

## Testing

### JavaScript/Playwright E2E Tests

End-to-end tests using Playwright to verify application functionality in browsers:

```bash
# Run all tests in headless mode
npm test

# Run tests with browser UI visible (useful for debugging)
npm run test:headed

# Run tests with Playwright UI mode (interactive test runner)
npm run test:ui
```

**Test Configuration**:
- **Config file**: `playwright.config.js`
- **Test files**: `tests/app.spec.js`
- **Browsers**: Chrome, Firefox, Safari
- **Base URL**: `http://localhost:8000` (auto-started with Python server)

**Test Coverage**:
- Application loading and title display
- UI element visibility and initial values
- Animation start/stop functionality
- Grid dimension changes and canvas resizing
- Image upload simulation (currently skipped)
- Input validation for grid values
- Animation state preservation during grid changes
- WebAssembly initialization error handling

### Rust Unit Tests

Standard Rust unit tests for core functionality:

```bash
# Run all Rust unit tests
cargo test
```

Tests are located in the `tests` module within `src/lib.rs` and cover:
- ImageBuffer initialization
- Pattern generation
- Memory management functions

### Rust/WASM Tests

WebAssembly-specific tests using wasm-bindgen-test:

```bash
# Run WASM tests in headless Chrome
wasm-pack test --chrome --headless

# Run WASM tests with browser visible (debugging)
wasm-pack test --chrome
```

Tests verify WebAssembly bindings and browser integration functionality.

### CI/CD Pipeline

Automated testing via GitHub Actions (`.github/workflows/test.yml`):

1. **Rust Tests**: `cargo test`
2. **WASM Build**: `wasm-pack build --target web --out-dir pkg`
3. **WASM Tests**: `wasm-pack test --chrome --headless`
4. **E2E Tests**: `npm test` (Playwright across all browsers)

The pipeline ensures all tests pass before allowing merges to main branch.

## Architecture Details

### Core Components

**ImageBuffer Struct** (`src/lib.rs`):
- Manages 800x800 RGBA pixel buffer in Rust heap memory
- Tracks loaded image position and dimensions for pattern preservation
- Exposes memory pointer to JavaScript via `data_ptr()` and `data_len()`

**Image Processing Pipeline**:
1. JavaScript reads file as ArrayBuffer via File API
2. Rust decodes JPEG/PNG using `image` crate  
3. Aspect-ratio preserving resize to fit 400x400 tile
4. Centering calculation within tile boundaries
5. Pixel copying with transparent padding

**Animation System**:
- `generate_pattern()`: Creates sine wave-based animated patterns, skipping loaded image areas
- JavaScript render loop: Uses `requestAnimationFrame` with FPS tracking
- Canvas update: `ImageData` created from WASM memory, drawn via `putImageData`

### Memory Management

JavaScript accesses Rust-managed memory directly:
```javascript
const wasmMemory = this.wasmModule.memory;
const uint8Array = new Uint8ClampedArray(wasmMemory.buffer, dataPtr, dataLen);
const imageData = new ImageData(uint8Array, 800, 800);
```

This zero-copy approach enables high-performance rendering but requires careful memory lifecycle management.

### Image Positioning Logic

- Loaded images are positioned in top-left corner of canvas (coordinates 0,0)
- Images are resized to fit within 400x400 pixel tile while preserving aspect ratio
- Centering is handled by calculating offsets: `(tile_size - actual_size) / 2`
- Pattern generation respects image boundaries to prevent overwriting

## File Structure

```
src/lib.rs          # Rust WebAssembly module
index.html          # Complete web application  
Cargo.toml          # Rust dependencies (wasm-bindgen, image crate)
pkg/                # Generated WebAssembly output (auto-generated)
target/             # Rust build artifacts (auto-generated)
```

## Dependencies

**Rust** (Cargo.toml):
- `wasm-bindgen`: WebAssembly-JavaScript bindings
- `image`: JPEG/PNG decoding with minimal feature set
- `web-sys`: Browser API access

**No JavaScript package manager** - all dependencies loaded via ES modules from generated `pkg/` directory.

## Git and GitHub Workflow

### Git Rules
- **Never commit unless explicitly asked to** - Always wait for user permission before making commits
- Use descriptive commit messages that explain both what and why
- Include `Closes #X` in commit messages when fixing GitHub issues

### GitHub Integration
- **GitHub CLI available**: Use `gh` tool to view and manage GitHub issues
- **View issues**: `gh issue view <number>` to see issue details
- **List issues**: `gh issue list` to see all open issues
- **Create sub-issues**: Use GitHub GraphQL API through `gh api graphql` to create and link sub-issues

#### Creating and Linking Sub-Issues

1. **Get repository ID** (needed for creating issues):
```bash
gh api repos/:owner/:repo --jq '.node_id'
```

2. **Create a new issue** (this will be the sub-issue):
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
      url
    }
  }
}'
```

3. **Link as proper sub-issue** (requires getting issue node IDs first):
```bash
# Get node IDs for issues
gh api graphql -f query='
{
  repository(owner: "OWNER", name: "REPO") {
    parentIssue: issue(number: PARENT_NUMBER) {
      id
    }
    subIssue: issue(number: SUB_NUMBER) {
      id
    }
  }
}'

# Link the sub-issue to parent
gh api graphql -H "GraphQL-Features: sub_issues" -f query='
mutation {
  addSubIssue(input: {
    issueId: "PARENT_NODE_ID"
    subIssueId: "SUB_NODE_ID"
  }) {
    clientMutationId
  }
}'
```