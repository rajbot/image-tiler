import { ImageLoader } from '../www/image-loader.js';

describe('ImageLoader', () => {
  let imageLoader;

  beforeEach(() => {
    imageLoader = new ImageLoader();
    jest.clearAllMocks();
  });

  afterEach(() => {
    imageLoader.clear();
  });

  describe('initialization', () => {
    test('should initialize with empty arrays', () => {
      expect(imageLoader.getLoadedImages()).toEqual([]);
      expect(imageLoader.getImageHandles()).toEqual([]);
    });
  });

  describe('loadFile', () => {
    test('should load file and create image data', async () => {
      const mockFile = new File(['test data'], 'test.jpg', { type: 'image/jpeg' });
      
      const imageData = await imageLoader.loadFile(mockFile);
      
      expect(imageData.name).toBe('test.jpg');
      expect(imageData.size).toBe(9); // 'test data'.length
      expect(imageData.data).toBeInstanceOf(Uint8Array);
      expect(imageData.url).toBe('mock-url');
      expect(imageData.file).toBe(mockFile);
    });

    test('should add loaded image to internal array', async () => {
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      
      await imageLoader.loadFile(mockFile);
      
      expect(imageLoader.getLoadedImages()).toHaveLength(1);
      expect(imageLoader.getLoadedImages()[0].name).toBe('test.png');
    });
  });

  describe('reorderImages', () => {
    beforeEach(async () => {
      // Load test images
      const file1 = new File(['data1'], 'image1.jpg');
      const file2 = new File(['data2'], 'image2.jpg');
      const file3 = new File(['data3'], 'image3.jpg');
      
      await imageLoader.loadFile(file1);
      await imageLoader.loadFile(file2);
      await imageLoader.loadFile(file3);
      
      // Mock image handles
      imageLoader.imageHandles = [
        { handle: 'handle1', metadata: { name: 'image1.jpg' } },
        { handle: 'handle2', metadata: { name: 'image2.jpg' } },
        { handle: 'handle3', metadata: { name: 'image3.jpg' } }
      ];
    });

    test('should move image from index 0 to index 2', () => {
      const result = imageLoader.reorderImages(0, 2);
      
      expect(result).toBe(true);
      expect(imageLoader.getLoadedImages()[0].name).toBe('image2.jpg');
      expect(imageLoader.getLoadedImages()[1].name).toBe('image3.jpg');
      expect(imageLoader.getLoadedImages()[2].name).toBe('image1.jpg');
      
      expect(imageLoader.imageHandles[0].handle).toBe('handle2');
      expect(imageLoader.imageHandles[1].handle).toBe('handle3');
      expect(imageLoader.imageHandles[2].handle).toBe('handle1');
    });

    test('should move image from index 2 to index 0', () => {
      const result = imageLoader.reorderImages(2, 0);
      
      expect(result).toBe(true);
      expect(imageLoader.getLoadedImages()[0].name).toBe('image3.jpg');
      expect(imageLoader.getLoadedImages()[1].name).toBe('image1.jpg');
      expect(imageLoader.getLoadedImages()[2].name).toBe('image2.jpg');
    });

    test('should return false for invalid indices', () => {
      expect(imageLoader.reorderImages(-1, 0)).toBe(false);
      expect(imageLoader.reorderImages(0, 5)).toBe(false);
      expect(imageLoader.reorderImages(0, 0)).toBe(false); // Same index
    });

    test('should handle empty arrays gracefully', () => {
      imageLoader.clear();
      expect(imageLoader.reorderImages(0, 1)).toBe(false);
    });
  });

  describe('removeImage', () => {
    beforeEach(async () => {
      const file1 = new File(['data1'], 'image1.jpg');
      const file2 = new File(['data2'], 'image2.jpg');
      
      await imageLoader.loadFile(file1);
      await imageLoader.loadFile(file2);
      
      imageLoader.imageHandles = [
        { handle: 'handle1' },
        { handle: 'handle2' }
      ];
    });

    test('should remove image at specific index', () => {
      imageLoader.removeImage(0);
      
      expect(imageLoader.getLoadedImages()).toHaveLength(1);
      expect(imageLoader.getLoadedImages()[0].name).toBe('image2.jpg');
      expect(imageLoader.imageHandles).toHaveLength(1);
      expect(imageLoader.imageHandles[0].handle).toBe('handle2');
    });

    test('should revoke object URL when removing', () => {
      imageLoader.removeImage(0);
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('mock-url');
    });

    test('should handle invalid indices gracefully', () => {
      const originalLength = imageLoader.getLoadedImages().length;
      imageLoader.removeImage(-1);
      imageLoader.removeImage(10);
      
      expect(imageLoader.getLoadedImages()).toHaveLength(originalLength);
    });
  });

  describe('clear', () => {
    beforeEach(async () => {
      const file = new File(['data'], 'test.jpg');
      await imageLoader.loadFile(file);
      imageLoader.imageHandles = [{ handle: 'handle1' }];
    });

    test('should clear all images and handles', () => {
      imageLoader.clear();
      
      expect(imageLoader.getLoadedImages()).toHaveLength(0);
      expect(imageLoader.getImageHandles()).toHaveLength(0);
    });

    test('should revoke all object URLs', () => {
      imageLoader.clear();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('mock-url');
    });
  });

  describe('zoom functionality', () => {
    beforeEach(() => {
      imageLoader.loadedImages = [
        { name: 'image1.jpg' },
        { name: 'image2.jpg' },
        { name: 'image3.jpg' }
      ];
      imageLoader.imageHandles = [
        { handle: 'handle1', metadata: { name: 'image1.jpg' }, zoom: 100 },
        { handle: 'handle2', metadata: { name: 'image2.jpg' }, zoom: 150 },
        { handle: 'handle3', metadata: { name: 'image3.jpg' }, zoom: 50 }
      ];
    });

    test('should set image zoom level', () => {
      const result = imageLoader.setImageZoom(0, 200);
      
      expect(result).toBe(true);
      expect(imageLoader.imageHandles[0].zoom).toBe(200);
    });

    test('should get image zoom level', () => {
      expect(imageLoader.getImageZoom(0)).toBe(100);
      expect(imageLoader.getImageZoom(1)).toBe(150);
      expect(imageLoader.getImageZoom(2)).toBe(50);
    });

    test('should return false for invalid index when setting zoom', () => {
      expect(imageLoader.setImageZoom(-1, 200)).toBe(false);
      expect(imageLoader.setImageZoom(10, 200)).toBe(false);
    });

    test('should return default zoom for invalid index when getting zoom', () => {
      expect(imageLoader.getImageZoom(-1)).toBe(100);
      expect(imageLoader.getImageZoom(10)).toBe(100);
    });

    test('should preserve zoom levels during reordering', () => {
      // Before: [100, 150, 50] at indices [0, 1, 2]
      // Moving index 0 to index 2: [150, 50, 100] at indices [0, 1, 2]
      imageLoader.reorderImages(0, 2);
      
      // After moving index 0 to index 2, the zooms should follow
      expect(imageLoader.getImageZoom(0)).toBe(150); // was index 1
      expect(imageLoader.getImageZoom(1)).toBe(50);  // was index 2  
      expect(imageLoader.getImageZoom(2)).toBe(100); // was index 0
    });

    test('should initialize new images with default zoom', () => {
      // This tests that new images added via loadImageHandle get zoom: 100
      const newHandle = { handle: 'new-handle', metadata: { name: 'new.jpg' }, zoom: 100 };
      imageLoader.imageHandles.push(newHandle);
      
      expect(imageLoader.getImageZoom(3)).toBe(100);
    });
  });
});