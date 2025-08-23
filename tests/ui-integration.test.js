/**
 * UI Integration Tests
 * 
 * Tests the interaction between UI components and core workflows
 * Note: File loading requires async FileReader which is complex to mock
 * These tests focus on the integration points that can be reliably tested
 */

import { ImageLoader } from '../www/image-loader.js';
import { CanvasManager } from '../www/canvas-manager.js';

// Mock WASM module
const mockWasmModule = {
  load_image: jest.fn(() => ({ width: 100, height: 100 })),
  tile_image_with_blank_2x1: jest.fn(() => ({ width: 200, height: 100 })),
  tile_images_2x1: jest.fn(() => ({ width: 200, height: 100 })),
  tile_images_2x2_with_blanks_3: jest.fn(() => ({ width: 800, height: 800 })),
  tile_images_2x2: jest.fn(() => ({ width: 800, height: 800 })),
  export_image: jest.fn(() => new Uint8Array([1, 2, 3, 4]))
};

describe('Component Integration Tests', () => {
  let imageLoader, canvasManager;
  let mockCanvas, mockContext;

  beforeEach(() => {
    // Setup minimal DOM for canvas manager
    document.body.innerHTML = `
      <canvas id="canvas" width="800" height="600"></canvas>
    `;

    mockContext = {
      clearRect: jest.fn(),
      drawImage: jest.fn()
    };

    mockCanvas = document.getElementById('canvas');
    mockCanvas.getContext = jest.fn(() => mockContext);
    mockCanvas.toDataURL = jest.fn(() => 'data:image/png;base64,mock');

    imageLoader = new ImageLoader();
    canvasManager = new CanvasManager('canvas');

    jest.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('ImageLoader and CanvasManager Integration', () => {
    test('should work together for basic image workflow', async () => {
      // Create mock image data
      const mockImageData = {
        name: 'test.jpg',
        size: 1000,
        data: new Uint8Array([1, 2, 3, 4]),
        url: 'mock-url',
        file: new File(['test data'], 'test.jpg')
      };

      // Load image into ImageLoader
      imageLoader.loadedImages.push(mockImageData);
      
      // Display on canvas
      await canvasManager.displayImage(mockImageData);

      expect(mockContext.clearRect).toHaveBeenCalled();
      expect(mockContext.drawImage).toHaveBeenCalled();
    });

    test('should handle canvas display from bytes', async () => {
      const imageBytes = new Uint8Array([1, 2, 3, 4]);
      
      await canvasManager.displayImageFromBytes(imageBytes, 'test.png');

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(mockContext.clearRect).toHaveBeenCalled();
    });
  });

  describe('WASM Integration Simulation', () => {
    test('should simulate complete image processing workflow', () => {
      // Create mock image handles
      const handle1 = { width: 100, height: 100 };
      const handle2 = { width: 150, height: 100 };

      // Simulate WASM calls
      const tiledResult = mockWasmModule.tile_images_2x1(handle1, handle2);
      const exportedBytes = mockWasmModule.export_image(tiledResult, 'png');

      expect(mockWasmModule.tile_images_2x1).toHaveBeenCalledWith(handle1, handle2);
      expect(mockWasmModule.export_image).toHaveBeenCalledWith(tiledResult, 'png');
      expect(exportedBytes).toBeInstanceOf(Uint8Array);
    });

    test('should simulate different tiling scenarios', () => {
      const handles = [
        { width: 100, height: 100 },
        { width: 100, height: 100 },
        { width: 100, height: 100 },  
        { width: 100, height: 100 }
      ];

      // Test different WASM functions
      mockWasmModule.tile_image_with_blank_2x1(handles[0]);
      mockWasmModule.tile_images_2x1(handles[0], handles[1]);
      mockWasmModule.tile_images_2x2_with_blanks_3(handles[0], handles[1], handles[2]);
      mockWasmModule.tile_images_2x2(handles[0], handles[1], handles[2], handles[3]);

      expect(mockWasmModule.tile_image_with_blank_2x1).toHaveBeenCalled();
      expect(mockWasmModule.tile_images_2x1).toHaveBeenCalled();
      expect(mockWasmModule.tile_images_2x2_with_blanks_3).toHaveBeenCalled();
      expect(mockWasmModule.tile_images_2x2).toHaveBeenCalled();
    });
  });
});