use std::fs;
use std::path::Path;
use image::GenericImageView;
use tauri::Manager;

/// Get the app's data directory for storing compressed images
fn get_data_dir() -> std::path::PathBuf {
    let base = std::env::temp_dir().join("yorutsuke-v2");
    fs::create_dir_all(&base).ok();
    base
}

/// Compression result returned to frontend
#[derive(serde::Serialize)]
pub struct CompressResult {
    pub success: bool,
    pub id: String,
    pub original_path: String,
    pub output_path: String,
    pub original_size: u64,
    pub compressed_size: u64,
    pub width: u32,
    pub height: u32,
    pub md5: String,
}

/// Compress an image: resize to max 1024px, convert to grayscale, WebP 75%
/// Grayscale conversion reduces file size by ~60% while maintaining OCR quality
#[tauri::command]
fn compress_image(input_path: String, image_id: String) -> Result<CompressResult, String> {
    let path = Path::new(&input_path);
    if !path.exists() {
        return Err(format!("File not found: {}", input_path));
    }

    // Get original file size
    let original_size = fs::metadata(path)
        .map_err(|e| format!("Failed to read metadata: {}", e))?
        .len();

    // Load image
    let img = image::open(path)
        .map_err(|e| format!("Failed to open image: {}", e))?;

    let (orig_width, orig_height) = img.dimensions();

    // Calculate new dimensions (max 1024px on longest side)
    const MAX_SIZE: u32 = 1024;
    let (new_width, new_height) = if orig_width > orig_height {
        if orig_width > MAX_SIZE {
            let ratio = MAX_SIZE as f32 / orig_width as f32;
            (MAX_SIZE, (orig_height as f32 * ratio) as u32)
        } else {
            (orig_width, orig_height)
        }
    } else if orig_height > MAX_SIZE {
        let ratio = MAX_SIZE as f32 / orig_height as f32;
        ((orig_width as f32 * ratio) as u32, MAX_SIZE)
    } else {
        (orig_width, orig_height)
    };

    // Resize if needed
    let resized = if new_width != orig_width || new_height != orig_height {
        img.resize_exact(new_width, new_height, image::imageops::FilterType::Lanczos3)
    } else {
        img
    };

    // Output path
    let output_path = get_data_dir().join(format!("{}.webp", image_id));

    // Convert to grayscale then to RGB8 for WebP encoding
    // Grayscale reduces file size significantly while maintaining OCR quality
    let grayscale = resized.grayscale();
    let rgb_image = grayscale.to_rgb8();

    // Get actual dimensions
    let actual_width = rgb_image.width();
    let actual_height = rgb_image.height();

    // Encode to WebP (75% quality - optimized for OCR)
    let encoder = webp::Encoder::from_rgb(&rgb_image, actual_width, actual_height);
    let webp_data = encoder.encode(75.0);

    // Calculate MD5 hash of compressed data (for duplicate detection)
    let md5_hash = format!("{:x}", md5::compute(&*webp_data));

    // Write to file
    fs::write(&output_path, &*webp_data)
        .map_err(|e| format!("Failed to write WebP: {}", e))?;

    let compressed_size = webp_data.len() as u64;
    let output_path_str = output_path.to_string_lossy().to_string();

    Ok(CompressResult {
        success: true,
        id: image_id,
        original_path: input_path,
        output_path: output_path_str,
        original_size,
        compressed_size,
        width: actual_width,
        height: actual_height,
        md5: md5_hash,
    })
}

/// Get MD5 hash of a file (for duplicate detection without compression)
#[tauri::command]
fn get_image_hash(path: String) -> Result<String, String> {
    let data = fs::read(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    Ok(format!("{:x}", md5::compute(&data)))
}

/// Delete a local file
#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Ok(()); // Not an error if file doesn't exist
    }
    fs::remove_file(file_path)
        .map_err(|e| format!("Failed to delete file: {}", e))
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Yorutsuke.", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            compress_image,
            get_image_hash,
            delete_file
        ])
        .setup(|_app| {
            // DevTools can be opened manually with Cmd+Option+I (macOS) or F12 (Windows/Linux)
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
