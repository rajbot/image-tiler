// Jest setup file
// Mock browser APIs that aren't available in Node.js

// Mock File and FileReader for testing file uploads
global.File = class MockFile {
  constructor(parts, filename, options = {}) {
    this.name = filename;
    this.size = parts.reduce((acc, part) => acc + part.length, 0);
    this.type = options.type || '';
    this.parts = parts;
  }
};

global.FileReader = class MockFileReader {
  constructor() {
    this.result = null;
    this.onload = null;
    this.onerror = null;
  }

  readAsArrayBuffer(file) {
    setTimeout(() => {
      this.result = new ArrayBuffer(file.size);
      if (this.onload) {
        this.onload({ target: { result: this.result } });
      }
    }, 0);
  }
};

// Mock URL for object URLs
global.URL = {
  createObjectURL: jest.fn(() => 'mock-url'),
  revokeObjectURL: jest.fn()
};

// Mock canvas context for testing
const mockContext = {
  clearRect: jest.fn(),
  drawImage: jest.fn(),
  getImageData: jest.fn(),
  putImageData: jest.fn()
};

global.HTMLCanvasElement.prototype.getContext = jest.fn(() => mockContext);
global.HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/png;base64,mock');

// Mock Image constructor
global.Image = class MockImage {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this.width = 100;
    this.height = 100;
  }

  set src(value) {
    setTimeout(() => {
      if (this.onload) {
        this.onload();
      }
    }, 0);
  }
};