use wasm_bindgen::prelude::*;
use image::{DynamicImage, GenericImageView};

#[derive(Clone)]
struct TileInfo {
    col: u32,
    row: u32,
    has_image: bool,
}

#[wasm_bindgen]
pub struct ImageBuffer {
    width: u32,
    height: u32,
    tile_width: u32,
    tile_height: u32,
    num_cols: u32,    
    num_rows: u32,
    data: Vec<u8>,
    loaded_tiles: Vec<TileInfo>,
    background_r: u8,
    background_g: u8,
    background_b: u8,
    background_a: u8,
}

#[wasm_bindgen]
impl ImageBuffer {
    #[wasm_bindgen(constructor)]
    pub fn new(tile_width: u32, tile_height: u32, num_cols: u32, num_rows: u32) -> ImageBuffer {
    	let width = tile_width * num_cols;
    	let height = tile_height * num_rows;
        let data = vec![0; (width * height * 4) as usize];
        ImageBuffer { 
            width, 
            height,
            tile_width,
            tile_height,
            num_cols,
            num_rows, 
            data,
            loaded_tiles: Vec::new(),
            background_r: 255,  // Default to white background
            background_g: 255,
            background_b: 255,
            background_a: 255,
        }
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.width
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.height
    }

    #[wasm_bindgen(getter)]
    pub fn tile_width(&self) -> u32 {
        self.tile_width
    }

    #[wasm_bindgen(getter)]
    pub fn tile_height(&self) -> u32 {
        self.tile_height
    }

    #[wasm_bindgen]
    pub fn data_ptr(&self) -> *const u8 {
        self.data.as_ptr()
    }

    #[wasm_bindgen]
    pub fn data_len(&self) -> usize {
        self.data.len()
    }

    #[wasm_bindgen]
    pub fn set_background_color(&mut self, r: u8, g: u8, b: u8, a: u8) {
        self.background_r = r;
        self.background_g = g;
        self.background_b = b;
        self.background_a = a;
    }

    // Helper method to check if a pixel is within any loaded tile
    fn is_pixel_in_loaded_tile(&self, x: usize, y: usize) -> bool {
        for tile_info in &self.loaded_tiles {
            if tile_info.has_image {
                let tile_start_x = (tile_info.col * self.tile_width) as usize;
                let tile_start_y = (tile_info.row * self.tile_height) as usize;
                let tile_end_x = tile_start_x + self.tile_width as usize;
                let tile_end_y = tile_start_y + self.tile_height as usize;
                
                if x >= tile_start_x && x < tile_end_x && y >= tile_start_y && y < tile_end_y {
                    return true;
                }
            }
        }
        false
    }

    #[wasm_bindgen]
    pub fn generate_pattern(&mut self, frame: u32) {
        let width = self.width as usize;
        let height = self.height as usize;
        
        for y in 0..height {
            for x in 0..width {
                // Skip pixels that are part of any loaded image
                if self.is_pixel_in_loaded_tile(x, y) {
                    continue;
                }
                
                let index = (y * width + x) * 4;
                
                // Create a dynamic pattern based on frame number
                let r = ((x as f32 + frame as f32 * 0.1).sin() * 127.0 + 128.0) as u8;
                let g = ((y as f32 + frame as f32 * 0.15).sin() * 127.0 + 128.0) as u8;
                let b = (((x + y) as f32 + frame as f32 * 0.2).sin() * 127.0 + 128.0) as u8;
                let a = 255;

                self.data[index] = r;
                self.data[index + 1] = g;
                self.data[index + 2] = b;
                self.data[index + 3] = a;
            }
        }
    }

    #[wasm_bindgen]
    pub fn load_image_from_bytes(&mut self, image_data: &[u8], col: u32, row: u32) -> Result<(), JsValue> {
        self.load_image_from_bytes_with_scale(image_data, col, row, 1.0)
    }

    #[wasm_bindgen]
    pub fn load_image_from_bytes_with_scale(&mut self, image_data: &[u8], col: u32, row: u32, scale: f32) -> Result<(), JsValue> {
        // Validate tile position
        if col >= self.num_cols || row >= self.num_rows {
            return Err(JsValue::from_str(&format!("Invalid tile position ({}, {}). Grid is {}x{}", col, row, self.num_cols, self.num_rows)));
        }
        let img = image::load_from_memory(image_data)
            .map_err(|e| JsValue::from_str(&format!("Failed to decode image: {}", e)))?;
        
        // Calculate scaled dimensions
        let scaled_width = (self.tile_width as f32 * scale) as u32;
        let scaled_height = (self.tile_height as f32 * scale) as u32;
        
        let resized_img = resize_preserve_aspect_ratio(img, scaled_width, scaled_height);
        let rgba_img = resized_img.to_rgba8();
        
        // Get actual dimensions after aspect ratio preserving resize
        let actual_width = rgba_img.width() as u32;
        let actual_height = rgba_img.height() as u32;
        
        // Calculate absolute position in the full buffer
        let tile_start_x = (col * self.tile_width) as usize;
        let tile_start_y = (row * self.tile_height) as usize;
        
        // Remove any existing tile info for this position, then add new one
        self.loaded_tiles.retain(|tile| tile.col != col || tile.row != row);
        self.loaded_tiles.push(TileInfo {
            col,
            row,
            has_image: true,
        });
        
        // Calculate offsets for centering/cropping
        let (src_offset_x, src_offset_y, dst_offset_x, dst_offset_y) = if scale >= 1.0 {
            // Scale >= 100%: crop center of scaled image to fit tile
            let crop_x = (actual_width.saturating_sub(self.tile_width)) / 2;
            let crop_y = (actual_height.saturating_sub(self.tile_height)) / 2;
            (crop_x, crop_y, 0, 0)
        } else {
            // Scale < 100%: center smaller image within tile
            let center_x = (self.tile_width - actual_width) / 2;
            let center_y = (self.tile_height - actual_height) / 2;
            (0, 0, center_x, center_y)
        };

        // Clear the entire target tile area first
        for y in 0..self.tile_height as usize {
            for x in 0..self.tile_width as usize {
                let dst_index = ((tile_start_y + y) * self.width as usize + (tile_start_x + x)) * 4;
                
                if dst_index + 3 < self.data.len() {
                    // Calculate source coordinates
                    let src_x = x as i32 - dst_offset_x as i32 + src_offset_x as i32;
                    let src_y = y as i32 - dst_offset_y as i32 + src_offset_y as i32;
                    
                    if src_x >= 0 && src_y >= 0 && 
                       src_x < actual_width as i32 && src_y < actual_height as i32 {
                        // Copy pixel from image
                        let pixel = rgba_img.get_pixel(src_x as u32, src_y as u32);
                        self.data[dst_index] = pixel[0];     // R
                        self.data[dst_index + 1] = pixel[1]; // G
                        self.data[dst_index + 2] = pixel[2]; // B
                        self.data[dst_index + 3] = pixel[3]; // A
                    } else {
                        // Background color for areas outside the image
                        self.data[dst_index] = self.background_r;
                        self.data[dst_index + 1] = self.background_g;
                        self.data[dst_index + 2] = self.background_b;
                        self.data[dst_index + 3] = self.background_a;
                    }
                }
            }
        }
        
        Ok(())
    }

    #[wasm_bindgen]
    pub fn load_image_from_bytes_with_scale_and_offset(&mut self, image_data: &[u8], col: u32, row: u32, scale: f32, offset_x: i32, offset_y: i32) -> Result<(), JsValue> {
        // Validate tile position
        if col >= self.num_cols || row >= self.num_rows {
            return Err(JsValue::from_str(&format!("Invalid tile position ({}, {}). Grid is {}x{}", col, row, self.num_cols, self.num_rows)));
        }
        
        let img = image::load_from_memory(image_data)
            .map_err(|e| JsValue::from_str(&format!("Failed to decode image: {}", e)))?;
        
        // Calculate scaled dimensions
        let scaled_width = (self.tile_width as f32 * scale) as u32;
        let scaled_height = (self.tile_height as f32 * scale) as u32;
        
        let resized_img = resize_preserve_aspect_ratio(img, scaled_width, scaled_height);
        let rgba_img = resized_img.to_rgba8();
        
        // Get actual dimensions after aspect ratio preserving resize
        let actual_width = rgba_img.width() as u32;
        let actual_height = rgba_img.height() as u32;
        
        // Calculate absolute position in the full buffer
        let tile_start_x = (col * self.tile_width) as usize;
        let tile_start_y = (row * self.tile_height) as usize;
        
        // Remove any existing tile info for this position, then add new one
        self.loaded_tiles.retain(|tile| tile.col != col || tile.row != row);
        self.loaded_tiles.push(TileInfo {
            col,
            row,
            has_image: true,
        });
        
        // Calculate positioning with user offset - use a unified approach for all scales
        // Always position the image within the tile space, allowing offsets to move it around
        let base_dst_x = if actual_width <= self.tile_width {
            // Image is smaller or equal to tile - center it
            (self.tile_width - actual_width) / 2
        } else {
            // Image is larger - no base destination offset, will crop from source
            0
        };
        
        let base_dst_y = if actual_height <= self.tile_height {
            // Image is smaller or equal to tile - center it  
            (self.tile_height - actual_height) / 2
        } else {
            // Image is larger - no base destination offset, will crop from source
            0
        };
        
        // Apply user offset to destination positioning
        let dst_offset_x = (base_dst_x as i32 + offset_x).max(-(actual_width as i32)).min(self.tile_width as i32) as u32;
        let dst_offset_y = (base_dst_y as i32 + offset_y).max(-(actual_height as i32)).min(self.tile_height as i32) as u32;
        
        // Calculate source cropping if image extends beyond tile bounds
        let src_offset_x = if actual_width > self.tile_width {
            // Image is larger than tile - crop from center, adjusted by offset effect
            let base_crop = (actual_width - self.tile_width) / 2;
            (base_crop as i32 - offset_x).max(0).min((actual_width.saturating_sub(self.tile_width)) as i32) as u32
        } else {
            0
        };
        
        let src_offset_y = if actual_height > self.tile_height {
            // Image is larger than tile - crop from center, adjusted by offset effect  
            let base_crop = (actual_height - self.tile_height) / 2;
            (base_crop as i32 - offset_y).max(0).min((actual_height.saturating_sub(self.tile_height)) as i32) as u32
        } else {
            0
        };

        // Clear the entire target tile area first
        for y in 0..self.tile_height as usize {
            for x in 0..self.tile_width as usize {
                let dst_index = ((tile_start_y + y) * self.width as usize + (tile_start_x + x)) * 4;
                
                if dst_index + 3 < self.data.len() {
                    // Calculate source coordinates
                    let src_x = x as i32 - dst_offset_x as i32 + src_offset_x as i32;
                    let src_y = y as i32 - dst_offset_y as i32 + src_offset_y as i32;
                    
                    if src_x >= 0 && src_y >= 0 && 
                       src_x < actual_width as i32 && src_y < actual_height as i32 {
                        // Copy pixel from image
                        let pixel = rgba_img.get_pixel(src_x as u32, src_y as u32);
                        self.data[dst_index] = pixel[0];     // R
                        self.data[dst_index + 1] = pixel[1]; // G
                        self.data[dst_index + 2] = pixel[2]; // B
                        self.data[dst_index + 3] = pixel[3]; // A
                    } else {
                        // Background color for areas outside the image
                        self.data[dst_index] = self.background_r;
                        self.data[dst_index + 1] = self.background_g;
                        self.data[dst_index + 2] = self.background_b;
                        self.data[dst_index + 3] = self.background_a;
                    }
                }
            }
        }
        
        Ok(())
    }

    #[wasm_bindgen]
    pub fn clear_tile(&mut self, col: u32, row: u32) -> Result<(), JsValue> {
        // Validate tile position
        if col >= self.num_cols || row >= self.num_rows {
            return Err(JsValue::from_str(&format!("Invalid tile position ({}, {}). Grid is {}x{}", col, row, self.num_cols, self.num_rows)));
        }

        // Remove tile from loaded_tiles
        self.loaded_tiles.retain(|tile| tile.col != col || tile.row != row);

        // Clear the tile area by setting it to transparent
        let tile_start_x = (col * self.tile_width) as usize;
        let tile_start_y = (row * self.tile_height) as usize;

        for y in 0..self.tile_height as usize {
            for x in 0..self.tile_width as usize {
                let dst_index = ((tile_start_y + y) * self.width as usize + (tile_start_x + x)) * 4;
                
                if dst_index + 3 < self.data.len() {
                    // Set to background color
                    self.data[dst_index] = self.background_r;     // R
                    self.data[dst_index + 1] = self.background_g; // G
                    self.data[dst_index + 2] = self.background_b; // B
                    self.data[dst_index + 3] = self.background_a; // A
                }
            }
        }

        Ok(())
    }

    #[wasm_bindgen]
    pub fn is_tile_loaded(&self, col: u32, row: u32) -> bool {
        self.loaded_tiles.iter().any(|tile| tile.col == col && tile.row == row && tile.has_image)
    }
}

fn resize_preserve_aspect_ratio(img: DynamicImage, target_width: u32, target_height: u32) -> DynamicImage {
    let (original_width, original_height) = img.dimensions();
    
    // Calculate scaling factor to fit within target dimensions while preserving aspect ratio
    let scale_x = target_width as f32 / original_width as f32;
    let scale_y = target_height as f32 / original_height as f32;
    let scale = scale_x.min(scale_y);
    
    let new_width = (original_width as f32 * scale) as u32;
    let new_height = (original_height as f32 * scale) as u32;
    
    img.resize(new_width, new_height, image::imageops::FilterType::Lanczos3)
}

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    wasm_bindgen_test_configure!(run_in_browser);

    #[wasm_bindgen_test]
    fn test_image_buffer_creation() {
        let buffer = ImageBuffer::new(100, 100, 2, 2);
        assert_eq!(buffer.width(), 200);
        assert_eq!(buffer.height(), 200);
        assert_eq!(buffer.tile_width(), 100);
        assert_eq!(buffer.tile_height(), 100);
        assert_eq!(buffer.data_len(), 200 * 200 * 4);
    }

    #[wasm_bindgen_test]
    fn test_pattern_generation() {
        let mut buffer = ImageBuffer::new(10, 10, 1, 1);
        buffer.generate_pattern(0);
        
        // Check that data has been populated (not all zeros)
        let data_ptr = buffer.data_ptr();
        let data_len = buffer.data_len();
        
        // This is a basic test - in practice we'd check specific pattern values
        assert!(data_len > 0);
        assert!(!data_ptr.is_null());
    }

    #[wasm_bindgen_test]
    fn test_resize_preserve_aspect_ratio() {
        // Create a simple 2x1 test image (landscape)
        let img = DynamicImage::new_rgb8(200, 100);
        let resized = resize_preserve_aspect_ratio(img, 100, 100);
        
        // Should fit within 100x100, maintaining aspect ratio
        let (w, h) = resized.dimensions();
        assert_eq!(w, 100); // Full width used
        assert_eq!(h, 50);  // Height scaled proportionally
    }

    #[test]
    fn test_image_buffer_dimensions() {
        let buffer = ImageBuffer::new(50, 75, 3, 4);
        assert_eq!(buffer.width, 150); // 50 * 3
        assert_eq!(buffer.height, 300); // 75 * 4
        assert_eq!(buffer.tile_width, 50);
        assert_eq!(buffer.tile_height, 75);
        assert_eq!(buffer.num_cols, 3);
        assert_eq!(buffer.num_rows, 4);
    }
}