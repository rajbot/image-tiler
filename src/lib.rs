use wasm_bindgen::prelude::*;
use image::{DynamicImage, GenericImageView};

#[wasm_bindgen]
pub struct ImageBuffer {
    width: u32,
    height: u32,
    tile_width: u32,
    tile_height: u32,
    num_cols: u32,    
    num_rows: u32,
    data: Vec<u8>,
    has_loaded_image: bool,
    image_start_x: usize,
    image_start_y: usize,
    image_width: u32,
    image_height: u32,
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
            has_loaded_image: false,
            image_start_x: 0,
            image_start_y: 0,
            image_width: 0,
            image_height: 0,
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
    pub fn generate_pattern(&mut self, frame: u32) {
        let width = self.width as usize;
        let height = self.height as usize;
        
        for y in 0..height {
            for x in 0..width {
                // Skip pixels that are part of the loaded image
                if self.has_loaded_image && 
                   x >= self.image_start_x && 
                   x < self.image_start_x + self.image_width as usize &&
                   y >= self.image_start_y && 
                   y < self.image_start_y + self.image_height as usize {
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
    pub fn load_image_from_bytes(&mut self, image_data: &[u8]) -> Result<(), JsValue> {
        let img = image::load_from_memory(image_data)
            .map_err(|e| JsValue::from_str(&format!("Failed to decode image: {}", e)))?;
        
        let resized_img = resize_preserve_aspect_ratio(img, self.tile_width, self.tile_height);
        let rgba_img = resized_img.to_rgba8();
        
        // Calculate centering offsets within the target tile
        let actual_width = rgba_img.width() as u32;
        let actual_height = rgba_img.height() as u32;
        let offset_x = (self.tile_width - actual_width) / 2;
        let offset_y = (self.tile_height - actual_height) / 2;
        
        // Store image position and dimensions for pattern generation
        self.image_start_x = 0;
        self.image_start_y = 0;
        self.image_width = self.tile_width;
        self.image_height = self.tile_height;
        self.has_loaded_image = true;
        
        // Clear the entire target area with transparent pixels first
        let start_x = self.image_start_x;
        let start_y = self.image_start_y;
        
        for y in 0..self.tile_height as usize {
            for x in 0..self.tile_width as usize {
                let dst_index = ((start_y + y) * self.width as usize + (start_x + x)) * 4;
                
                if dst_index + 3 < self.data.len() {
                    // Check if we're within the centered image bounds
                    let img_x = x as i32 - offset_x as i32;
                    let img_y = y as i32 - offset_y as i32;
                    
                    if img_x >= 0 && img_y >= 0 && 
                       img_x < actual_width as i32 && img_y < actual_height as i32 {
                        // Copy pixel from centered image
                        let pixel = rgba_img.get_pixel(img_x as u32, img_y as u32);
                        self.data[dst_index] = pixel[0];     // R
                        self.data[dst_index + 1] = pixel[1]; // G
                        self.data[dst_index + 2] = pixel[2]; // B
                        self.data[dst_index + 3] = pixel[3]; // A
                    } else {
                        // Transparent pixel for areas outside the centered image
                        self.data[dst_index] = 0;
                        self.data[dst_index + 1] = 0;
                        self.data[dst_index + 2] = 0;
                        self.data[dst_index + 3] = 0;
                    }
                }
            }
        }
        
        Ok(())
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