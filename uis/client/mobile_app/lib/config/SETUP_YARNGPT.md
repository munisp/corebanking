# YarnGPT Configuration Setup

## For New Developers

To set up YarnGPT for voice banking:

1. **Copy the template file:**

   ```bash
   cp lib/config/yarngpt_config.dart.example lib/config/yarngpt_config.dart
   ```

2. **Get your API key:**
   - Sign up at https://yarngpt.com
   - Go to Dashboard → API Keys
   - Create a new API key

3. **Update the config:**
   - Open `lib/config/yarngpt_config.dart`
   - Replace `YOUR_YARNGPT_API_KEY_HERE` with your actual API key
   - Save the file

4. **Verify it works:**
   ```bash
   flutter run
   ```

   - Open Voice Banking
   - Enable YarnGPT toggle
   - Test with a voice command

## Security Note

⚠️ **NEVER commit `yarngpt_config.dart` to version control!**

The file is already in `.gitignore` to prevent accidental commits.

## Files

- `yarngpt_config.dart.example` - Template (committed to git)
- `yarngpt_config.dart` - Your actual config (ignored by git)

## Troubleshooting

### "API key not configured"

- Check that `yarngpt_config.dart` exists
- Verify API key is not the placeholder text
- Ensure `enabledByDefault = true`

### "API request failed"

- Verify API key is valid
- Check internet connection
- Confirm API endpoint is correct
