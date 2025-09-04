import { CanvasManager } from '../www/canvas-manager.js';

describe('CanvasManager', () => {
  let canvasManager;
  let mockCanvas;
  let mockContext;

  beforeEach(() => {
    // Create mock canvas element
    mockContext = {
      clearRect: jest.fn(),
      drawImage: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      strokeRect: jest.fn(),
      setLineDash: jest.fn()
    };

    const mockParentElement = {
      getBoundingClientRect: jest.fn(() => ({
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        bottom: 600,
        right: 800
      }))
    };

    mockCanvas = {
      width: 780,
      height: 460,
      getContext: jest.fn(() => mockContext),
      toDataURL: jest.fn(() => 'data:image/png;base64,mockdata'),
      parentElement: mockParentElement,
      getBoundingClientRect: jest.fn(() => ({
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        bottom: 600,
        right: 800
      })),
      addEventListener: jest.fn(),
      style: { cursor: 'default' }
    };

    // Mock getElementById to return our mock canvas
    document.getElementById = jest.fn(() => mockCanvas);
    
    canvasManager = new CanvasManager('test-canvas');
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    test('should initialize with canvas and context', () => {
      expect(canvasManager.canvas).toBe(mockCanvas);
      expect(canvasManager.ctx).toBe(mockContext);
    });
  });

  describe('displayImage', () => {
    test('should display image with proper scaling', async () => {
      const imageData = {
        url: 'mock-image-url',
        name: 'test-image.jpg'
      };

      await canvasManager.displayImage(imageData);

      expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 780, 480);
      expect(mockContext.drawImage).toHaveBeenCalled();
    });

    test('should handle image load errors', async () => {
      const imageData = {
        url: 'invalid-url',
        name: 'bad-image.jpg'
      };

      // Mock Image to trigger error
      const originalImage = global.Image;
      global.Image = class MockImageError {
        constructor() {
          this.onerror = null;
          this.onload = null;
        }
        set src(value) {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror();
            }
          }, 0);
        }
      };

      await expect(canvasManager.displayImage(imageData)).rejects.toThrow('Failed to load image');
      
      global.Image = originalImage;
    });
  });

  describe('displayImageFromBytes', () => {
    test('should create blob and display image', async () => {
      const imageBytes = new Uint8Array([1, 2, 3, 4]);
      
      // Mock Blob constructor
      global.Blob = jest.fn(() => ({ type: 'image/png' }));
      
      await canvasManager.displayImageFromBytes(imageBytes, 'test.png');

      expect(global.Blob).toHaveBeenCalledWith([imageBytes], { type: 'image/png' });
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(mockContext.clearRect).toHaveBeenCalled();
      expect(mockContext.drawImage).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    test('should clear canvas and current image', () => {
      canvasManager.currentImage = {
        url: 'test-url'
      };

      canvasManager.clear();

      expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 780, 480);
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('test-url');
      expect(canvasManager.currentImage).toBeNull();
    });

    test('should handle null current image', () => {
      canvasManager.currentImage = null;
      
      expect(() => canvasManager.clear()).not.toThrow();
      expect(mockContext.clearRect).toHaveBeenCalled();
    });
  });

  describe('downloadImage', () => {
    test('should create download link with blob URL', () => {
      canvasManager.currentImage = {
        blob: new Blob(),
        url: 'blob-url'
      };

      // Mock DOM manipulation
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn()
      };
      document.createElement = jest.fn(() => mockLink);
      document.body.appendChild = jest.fn();
      document.body.removeChild = jest.fn();

      canvasManager.downloadImage('test-image.png');

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.href).toBe('blob-url');
      expect(mockLink.download).toBe('test-image.png');
      expect(mockLink.click).toHaveBeenCalled();
    });

    test('should use canvas data URL if no blob available', () => {
      canvasManager.currentImage = {
        image: {}
      };

      const mockLink = {
        href: '',
        download: '',
        click: jest.fn()
      };
      document.createElement = jest.fn(() => mockLink);
      document.body.appendChild = jest.fn();
      document.body.removeChild = jest.fn();

      canvasManager.downloadImage('test.png');

      expect(mockCanvas.toDataURL).toHaveBeenCalled();
      expect(mockLink.href).toBe('data:image/png;base64,mockdata');
    });

    test('should throw error if no current image', () => {
      canvasManager.currentImage = null;
      
      expect(() => canvasManager.downloadImage()).toThrow('No image to download');
    });
  });

  describe('getCurrentImageData', () => {
    test('should return current image data', () => {
      const testImageData = { width: 100, height: 100 };
      canvasManager.currentImage = testImageData;
      
      expect(canvasManager.getCurrentImageData()).toBe(testImageData);
    });
  });

  describe('image selection', () => {
    beforeEach(() => {
      // Setup image positions for selection testing
      canvasManager.imagePositions = [
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 100, y: 0, width: 100, height: 100 },
        { x: 0, y: 100, width: 100, height: 100 }
      ];
      canvasManager.currentImage = {
        image: new Image(),
        x: 0,
        y: 0,
        width: 200,
        height: 200
      };
    });

    test('should select image when clicked within bounds', () => {
      const mockCallback = jest.fn();
      canvasManager.onImageSelected = mockCallback;

      // Click on first image (position 0)
      canvasManager.handleCanvasClick(50, 50);

      expect(canvasManager.selectedImageIndex).toBe(0);
      expect(mockCallback).toHaveBeenCalledWith(0);
    });

    test('should select different image when clicked', () => {
      const mockCallback = jest.fn();
      canvasManager.onImageSelected = mockCallback;

      // Click on second image (position 1)
      canvasManager.handleCanvasClick(150, 50);

      expect(canvasManager.selectedImageIndex).toBe(1);
      expect(mockCallback).toHaveBeenCalledWith(1);
    });

    test('should deselect when clicking on already selected image', () => {
      const mockCallback = jest.fn();
      canvasManager.onImageSelected = mockCallback;
      canvasManager.selectedImageIndex = 0; // Pre-select first image

      // Click on same image again
      canvasManager.handleCanvasClick(50, 50);

      expect(canvasManager.selectedImageIndex).toBe(-1);
      expect(mockCallback).toHaveBeenCalledWith(-1);
    });

    test('should deselect when clicking outside all images', () => {
      const mockCallback = jest.fn();
      canvasManager.onImageSelected = mockCallback;
      canvasManager.selectedImageIndex = 0; // Pre-select first image

      // Click outside all image bounds
      canvasManager.handleCanvasClick(300, 300);

      expect(canvasManager.selectedImageIndex).toBe(-1);
      expect(mockCallback).toHaveBeenCalledWith(-1);
    });

    test('should not trigger callback when no callback is set', () => {
      canvasManager.onImageSelected = null;

      // Should not throw error
      expect(() => {
        canvasManager.handleCanvasClick(50, 50);
      }).not.toThrow();

      expect(canvasManager.selectedImageIndex).toBe(0);
    });

    test('should redraw with selection when image is selected', () => {
      const redrawSpy = jest.spyOn(canvasManager, 'redrawWithSelection');
      
      canvasManager.handleCanvasClick(50, 50);

      expect(redrawSpy).toHaveBeenCalled();
    });

    test('should draw marching ants when image is selected', () => {
      canvasManager.selectedImageIndex = 0;
      const marchingAntsSpy = jest.spyOn(canvasManager, 'drawMarchingAnts');

      canvasManager.redrawWithSelection();

      expect(marchingAntsSpy).toHaveBeenCalledWith(0, 0, 100, 100);
    });

    test('should not draw marching ants when no image is selected', () => {
      canvasManager.selectedImageIndex = -1;
      const marchingAntsSpy = jest.spyOn(canvasManager, 'drawMarchingAnts');

      canvasManager.redrawWithSelection();

      expect(marchingAntsSpy).not.toHaveBeenCalled();
    });

    test('should clear selection when canvas is cleared', () => {
      const mockCallback = jest.fn();
      canvasManager.onImageSelected = mockCallback;
      canvasManager.selectedImageIndex = 1; // Pre-select image

      canvasManager.clear();

      expect(canvasManager.selectedImageIndex).toBe(-1);
      expect(canvasManager.imagePositions).toEqual([]);
      expect(mockCallback).toHaveBeenCalledWith(-1);
    });
  });
});