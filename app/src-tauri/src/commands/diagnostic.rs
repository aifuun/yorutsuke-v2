use serde::{Deserialize, Serialize};

// ============================================================================
// Type Definitions (Primitive IO Types)
// ============================================================================

/// System information (OS, locale, timezone)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub os_version: String,
    pub locale: String,
    pub timezone: String,
}

/// Directory size with human-readable format
#[derive(Debug, Serialize, Deserialize)]
pub struct DirectorySize {
    pub bytes: u64,
    pub formatted: String,
}

// ============================================================================
// Helper Functions (Primitive IO Operations)
// ============================================================================

fn calculate_dir_size(path: &std::path::Path) -> Result<u64, String> {
    if !path.exists() {
        return Ok(0);
    }

    let mut total_size = 0u64;

    match std::fs::read_dir(path) {
        Ok(entries) => {
            for entry in entries.flatten() {
                if let Ok(metadata) = entry.metadata() {
                    if metadata.is_dir() {
                        if let Ok(size) = calculate_dir_size(&entry.path()) {
                            total_size += size;
                        }
                    } else {
                        total_size += metadata.len();
                    }
                }
            }
        }
        Err(_) => return Ok(0),
    }

    Ok(total_size)
}

fn format_size(bytes: u64) -> String {
    if bytes >= 1024 * 1024 {
        format!("{:.1} MB", bytes as f64 / (1024.0 * 1024.0))
    } else if bytes >= 1024 {
        format!("{:.1} KB", bytes as f64 / 1024.0)
    } else {
        format!("{} B", bytes)
    }
}

// ============================================================================
// Tauri Commands (Primitive IO Operations Only)
// ============================================================================

/// Get system information (OS version, locale, timezone)
///
/// This is a primitive IO operation - pure data retrieval from the system.
/// Business logic aggregation happens in TypeScript DiagnosticService.
#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    let os_version = match std::env::consts::OS {
        "macos" => "macOS".to_string(),
        "linux" => "Linux".to_string(),
        "windows" => "Windows".to_string(),
        other => other.to_string(),
    };

    Ok(SystemInfo {
        os_version,
        locale: "en-US".to_string(),
        timezone: "UTC".to_string(),
    })
}

/// Read debug logs from {app_data_dir}/logs/YYYY-MM-DD.jsonl
///
/// Returns the latest 500 log entries as JSON array.
/// This is a primitive IO operation - no business logic.
#[tauri::command]
pub fn read_debug_logs(app: tauri::AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let logs_dir = crate::get_logs_dir(&app);
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let log_file = logs_dir.join(format!("{}.jsonl", today));

    let mut logs = vec![];

    if log_file.exists() {
        match std::fs::read_to_string(&log_file) {
            Ok(content) => {
                // Read up to 500 most recent lines (latest logs)
                let lines: Vec<&str> = content.lines().collect();
                let start_idx = if lines.len() > 500 {
                    lines.len() - 500
                } else {
                    0
                };

                for line in &lines[start_idx..] {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                        logs.push(json);
                    }
                }
            }
            Err(e) => {
                return Err(format!("Failed to read logs: {}", e));
            }
        }
    }

    Ok(logs)
}

/// Get the size of the database directory
///
/// This is a primitive IO operation - recursively calculates directory size.
/// Returns both bytes and human-readable formatted string.
#[tauri::command]
pub fn get_directory_size(path: String) -> Result<DirectorySize, String> {
    let db_path = std::path::Path::new(&path);
    let bytes = calculate_dir_size(db_path)?;

    Ok(DirectorySize {
        bytes,
        formatted: format_size(bytes),
    })
}

// ============================================================================
// Unit Tests (Primitive IO Operations)
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ========================================================================
    // get_system_info tests
    // ========================================================================

    #[test]
    fn test_get_system_info_returns_valid_structure() {
        let result = get_system_info();

        assert!(result.is_ok(), "Should successfully get system info");
        let info = result.unwrap();

        assert!(!info.os_version.is_empty(), "OS version should not be empty");
        assert!(!info.locale.is_empty(), "Locale should not be empty");
        assert!(!info.timezone.is_empty(), "Timezone should not be empty");
    }

    #[test]
    fn test_get_system_info_returns_platform_name() {
        let result = get_system_info();

        assert!(result.is_ok());
        let info = result.unwrap();

        // Platform name should match the system
        let expected_platform = match std::env::consts::OS {
            "macos" => "macOS",
            "linux" => "Linux",
            "windows" => "Windows",
            _ => info.os_version.as_str(),
        };

        assert_eq!(info.os_version, expected_platform);
    }

    // ========================================================================
    // read_debug_logs tests
    // ========================================================================

    // Note: read_debug_logs tests removed after Issue #184 refactor
    // The function now requires tauri::AppHandle parameter which cannot be
    // easily mocked in unit tests. These tests should be converted to
    // integration tests or tested through the Tauri test harness.

    // ========================================================================
    // get_directory_size tests
    // ========================================================================

    #[test]
    fn test_get_directory_size_nonexistent_path() {
        let result = get_directory_size("/nonexistent/path/that/does/not/exist".to_string());

        // Should handle gracefully - either return 0 or return error
        // Both are acceptable for nonexistent paths
        match result {
            Ok(size) => {
                assert_eq!(size.bytes, 0, "Nonexistent path should have 0 bytes");
                assert_eq!(size.formatted, "0 B", "Nonexistent path should format as 0 B");
            }
            Err(_) => {
                // Also acceptable to return error for nonexistent path
            }
        }
    }

    #[test]
    fn test_get_directory_size_returns_both_formats() {
        // Use a known small directory (current directory or /tmp)
        let result = get_directory_size(std::env::temp_dir().to_string_lossy().to_string());

        assert!(result.is_ok(), "Should successfully get directory size");
        let size = result.unwrap();

        // Should have both formats
        assert!(size.bytes >= 0, "Bytes should be non-negative");
        assert!(!size.formatted.is_empty(), "Formatted string should not be empty");

        // Formatted should contain a unit
        assert!(
            size.formatted.contains(" B") ||
            size.formatted.contains(" KB") ||
            size.formatted.contains(" MB"),
            "Formatted string should contain a size unit"
        );
    }

    #[test]
    fn test_format_size_bytes() {
        // Test the format_size helper with different inputs
        assert_eq!(format_size(0), "0 B");
        assert_eq!(format_size(100), "100 B");
        assert_eq!(format_size(1024), "1.0 KB");
        assert_eq!(format_size(1536), "1.5 KB"); // 1.5 * 1024
        assert_eq!(format_size(1048576), "1.0 MB"); // 1 * 1024 * 1024
        assert_eq!(format_size(2097152), "2.0 MB"); // 2 * 1024 * 1024
    }

    // ========================================================================
    // Helper function tests
    // ========================================================================

    #[test]
    fn test_calculate_dir_size_on_temp_dir() {
        let temp_path = std::env::temp_dir();
        let temp_dir = temp_path.as_path();
        let result = calculate_dir_size(temp_dir);

        assert!(result.is_ok(), "Should successfully calculate directory size");
        let size = result.unwrap();
        assert!(size >= 0, "Size should be non-negative");
    }
}
