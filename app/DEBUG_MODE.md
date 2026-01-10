# Debug Mode Configuration

## Enabling Debug Panel

The debug panel is only available in development mode and requires a configuration file.

### Steps to Enable

1. Create a file named `debug.json` in one of these locations:

   **Option 1: AppConfig Directory** (Recommended)
   - macOS: `~/Library/Application Support/com.yorutsuke.app/debug.json`
   - Linux: `~/.config/yorutsuke/debug.json`
   - Windows: `%APPDATA%\com.yorutsuke.app\debug.json`

   **Option 2: AppLocalData Directory**
   - macOS: `~/Library/Application Support/com.yorutsuke.app/debug.json`
   - Linux: `~/.local/share/yorutsuke/debug.json`
   - Windows: `%LOCALAPPDATA%\com.yorutsuke.app\debug.json`

2. Add the following content to `debug.json`:
   ```json
   {
     "debug": true
   }
   ```

3. Restart the app

### Disabling Debug Panel

To disable the debug panel:
- Delete the `debug.json` file, OR
- Change the content to:
  ```json
  {
    "debug": false
  }
  ```

### Example File

See `debug.json.example` for a template.

### Security Notes

- Debug panel is **ALWAYS** disabled in production builds
- The `debug.json` file is ignored by git (`.gitignore`)
- Each developer can have their own debug configuration

### Troubleshooting

If the debug panel doesn't appear:
1. Check the console logs for `debug_config_loaded` messages
2. Verify the JSON format is valid (use a JSON validator)
3. Ensure the file is in the correct location
4. Restart the app after creating/modifying the file

### Quick Command (macOS/Linux)

```bash
# Create debug.json in AppConfig directory
mkdir -p ~/Library/Application\ Support/com.yorutsuke.app
echo '{"debug": true}' > ~/Library/Application\ Support/com.yorutsuke.app/debug.json
```
