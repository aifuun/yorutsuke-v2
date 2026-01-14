use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;
use chrono::{Local, Duration};
use image::GenericImageView;
use image::codecs::jpeg::JpegEncoder;

/// Get the app's data directory for storing compressed images
/// Uses platform-standard data directory for permanent local storage
/// - macOS: ~/Library/Application Support/yorutsuke-v2/images/
/// - Linux: ~/.local/share/yorutsuke-v2/images/
/// - Windows: C:\Users\<user>\AppData\Local\yorutsuke-v2\images\
fn get_data_dir() -> std::path::PathBuf {
    let base = dirs::data_local_dir()
        .or_else(dirs::data_dir)
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_else(std::env::temp_dir));
    let images_dir = base.join("yorutsuke-v2").join("images");
    fs::create_dir_all(&images_dir).ok();
    images_dir
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

/// Compress an image: resize to max 1536px, convert to grayscale, JPEG 75%
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

    // Calculate new dimensions (max 1536px on longest side)
    const MAX_SIZE: u32 = 1536;
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
    let output_path = get_data_dir().join(format!("{}.jpg", image_id));

    // Convert to grayscale then to RGB8 for JPEG encoding
    // Grayscale reduces file size significantly while maintaining OCR quality
    let grayscale = resized.grayscale();
    let rgb_image = grayscale.to_rgb8();

    // Get actual dimensions
    let actual_width = rgb_image.width();
    let actual_height = rgb_image.height();

    // Encode to JPEG (75% quality - balanced for OCR and file size)
    let file = fs::File::create(&output_path)
        .map_err(|e| format!("Failed to create output file: {}", e))?;
    let mut encoder = JpegEncoder::new_with_quality(file, 75);
    encoder.encode(&rgb_image, actual_width, actual_height, image::ExtendedColorType::Rgb8)
        .map_err(|e| format!("Failed to encode JPEG: {}", e))?;

    // Calculate MD5 hash of compressed data (for duplicate detection)
    let jpeg_data = fs::read(&output_path)
        .map_err(|e| format!("Failed to read JPEG file: {}", e))?;
    let md5_hash = format!("{:x}", md5::compute(&jpeg_data));

    // Get compressed file size
    let compressed_size = fs::metadata(&output_path)
        .map_err(|e| format!("Failed to get file size: {}", e))?
        .len();
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

// ============================================================================
// Logging System (Pillar R: Observability)
// ============================================================================

/// Get the logs directory (~/.yorutsuke/logs/)
fn get_logs_dir() -> std::path::PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| std::env::temp_dir());
    let logs_dir = home.join(".yorutsuke").join("logs");
    fs::create_dir_all(&logs_dir).ok();
    logs_dir
}

/// Log entry from frontend
#[derive(serde::Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub event: String,
    #[serde(rename = "traceId")]
    pub trace_id: String,
    #[serde(rename = "userId")]
    pub user_id: Option<String>,
    #[serde(flatten)]
    pub extra: std::collections::HashMap<String, serde_json::Value>,
}

/// Write a log entry to the daily log file
/// File format: ~/.yorutsuke/logs/YYYY-MM-DD.jsonl
#[tauri::command]
fn log_write(entry: LogEntry) -> Result<(), String> {
    let logs_dir = get_logs_dir();
    let today = Local::now().format("%Y-%m-%d").to_string();
    let log_file = logs_dir.join(format!("{}.jsonl", today));

    // Reconstruct the full JSON entry
    let mut json_obj = serde_json::json!({
        "timestamp": entry.timestamp,
        "level": entry.level,
        "event": entry.event,
        "traceId": entry.trace_id,
    });

    if let Some(user_id) = &entry.user_id {
        json_obj["userId"] = serde_json::json!(user_id);
    }

    // Merge extra fields
    if let serde_json::Value::Object(ref mut map) = json_obj {
        for (key, value) in entry.extra {
            map.insert(key, value);
        }
    }

    let json_line = serde_json::to_string(&json_obj)
        .map_err(|e| format!("Failed to serialize log entry: {}", e))?;

    // Append to file
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file)
        .map_err(|e| format!("Failed to open log file: {}", e))?;

    writeln!(file, "{}", json_line)
        .map_err(|e| format!("Failed to write log entry: {}", e))?;

    Ok(())
}

/// Clean up log files older than retention days (default: 7)
#[tauri::command]
fn log_cleanup(retention_days: Option<i64>) -> Result<u32, String> {
    let retention = retention_days.unwrap_or(7);
    let logs_dir = get_logs_dir();
    let cutoff = Local::now() - Duration::days(retention);
    let cutoff_str = cutoff.format("%Y-%m-%d").to_string();

    let mut deleted_count = 0u32;

    let entries = fs::read_dir(&logs_dir)
        .map_err(|e| format!("Failed to read logs directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
            // Only process .jsonl files with date format
            if filename.ends_with(".jsonl") && filename.len() == 15 {
                let date_part = &filename[..10]; // YYYY-MM-DD
                if date_part < cutoff_str.as_str() {
                    if fs::remove_file(&path).is_ok() {
                        deleted_count += 1;
                    }
                }
            }
        }
    }

    Ok(deleted_count)
}

/// Get the path to today's log file (for debugging)
#[tauri::command]
fn log_get_path() -> String {
    let logs_dir = get_logs_dir();
    let today = Local::now().format("%Y-%m-%d").to_string();
    logs_dir.join(format!("{}.jsonl", today)).to_string_lossy().to_string()
}

/// Get the machine's unique identifier
/// Uses OS-level machine ID that persists across app reinstalls
/// - macOS: IOPlatformUUID
/// - Linux: /etc/machine-id
/// - Windows: MachineGuid from registry
#[tauri::command]
fn get_machine_id() -> Result<String, String> {
    machine_uid::get().map_err(|e| format!("Failed to get machine ID: {}", e))
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
            delete_file,
            log_write,
            log_cleanup,
            log_get_path,
            get_machine_id
        ])
        .setup(|_app| {
            // DevTools can be opened manually with Cmd+Option+I (macOS) or F12 (Windows/Linux)
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
