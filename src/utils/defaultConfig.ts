/**
 * Loads the gateway default config from `config.json` at server start.
 * If the file does not exist or cannot be parsed, defaultConfig will be null.
 *
 * The config.json must contain a valid portkey gateway config object, e.g.:
 * {
 *   "provider": "openai",
 *   "api_key": "sk-..."
 * }
 */

let defaultConfig: string | null = null;

try {
  const { readFileSync } = await import('fs');
  const raw = readFileSync('./config.json', 'utf-8');
  // Validate it is parseable JSON — will throw if not
  JSON.parse(raw);
  defaultConfig = raw.trim();
  console.log('✅ Default gateway config loaded from config.json');
} catch (err: any) {
  if (err?.code === 'ENOENT') {
    // File simply doesn't exist — that's fine, no default config
  } else {
    console.warn(
      '⚠️  Could not load default gateway config from config.json:',
      err?.message
    );
  }
}

export { defaultConfig };
