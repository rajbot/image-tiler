# Image Tiler

A high-performance image tiling application that combines images into 2x1 or 2x2 layouts. Built with Rust/WebAssembly for fast image processing and a modern JavaScript frontend.

![Image Tiler Demo](https://via.placeholder.com/600x300/2d3748/ffffff?text=Image+Tiler+Demo)

## Features

- **Drag & Drop Interface** - Simply drag images from your computer into the browser
- **Multiple Tiling Layouts** - Create 2x1 (side-by-side) or 2x2 (four-image grid) compositions
- **Auto Preview** - Automatically generates preview as you add images
- **Image Reordering** - Click to select and drag images to rearrange them
- **Aspect Ratio Preservation** - Maintains original image proportions on black backgrounds
- **Export Functionality** - Download your tiled compositions as PNG or JPEG
- **High Performance** - Uses Rust/WebAssembly for fast image processing
- **Format Support** - Works with PNG, JPEG, and WebP images

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or later)
- [Rust](https://rustup.rs/) with `wasm-pack` installed

```bash
# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/image-tiler.git
cd image-tiler
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open http://localhost:8080 in your browser

## Usage

1. **Load Images**: Drag and drop image files into the browser window
2. **Reorder Images**: Click an image to select it, then drag to reorder
3. **Auto Preview**: The app automatically creates a preview as you add images:
   - 1 image: Shows with blank space in 2x1 layout
   - 2 images: Creates 2x1 side-by-side layout
   - 3 images: Creates 2x2 layout with one blank space
   - 4 images: Creates complete 2x2 grid
4. **Export**: Click "Download Image" to save your tiled composition

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run wasm-build` - Build only the WebAssembly module
- `npm run preview` - Build and serve production version locally
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

### Architecture

The application uses a hybrid architecture:

- **Rust Backend** (`src/lib.rs`) - High-performance image processing using the `image` crate
- **JavaScript Frontend** (`www/`) - Modern ES6 modules for UI management
- **WebAssembly Bridge** - wasm-bindgen for seamless Rust-JS interop

### Key Components

- **ImageLoader** - Handles file loading and image data management
- **CanvasManager** - Manages HTML5 canvas rendering and display
- **UIController** - Coordinates user interactions and auto-preview logic

### Testing

The project includes comprehensive test coverage:

- **Rust Unit Tests** - Test image processing helper functions
- **JavaScript Tests** - Component and integration testing with Jest
- **WASM Integration Tests** - WebAssembly module testing
- **CI/CD Pipeline** - Automated testing via GitHub Actions

Run tests:
```bash
# All tests
npm test

# Rust tests only
cargo test

# JavaScript tests only
npm test -- --testPathPattern=tests/

# Watch mode
npm run test:watch
```

## Building for Production

1. Build the project:
```bash
npm run build
```

2. Deploy the `dist/` folder to your web server

The project includes GitHub Actions for automatic deployment to GitHub Pages.

## Browser Support

- Modern browsers with WebAssembly support
- Chrome 57+, Firefox 52+, Safari 11+, Edge 16+

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run the test suite: `npm test`
5. Commit your changes: `git commit -m "Add feature"`
6. Push to your branch: `git push origin feature-name`
7. Create a Pull Request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Built with [Rust](https://www.rust-lang.org/) and [WebAssembly](https://webassembly.org/)
- Image processing powered by the [image crate](https://github.com/image-rs/image)
- Frontend bundling with [Webpack](https://webpack.js.org/)
- Testing with [Jest](https://jestjs.io/)