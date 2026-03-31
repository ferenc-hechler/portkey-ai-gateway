import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

type FileConfigModule = { processNamedConfig: (name?: string | null) => string | null };

/**
 * Writes a temp config file, sets env vars, then loads fileConfig.ts in an
 * isolated module registry so its top-level side-effects re-execute.
 * Cleans up afterwards.
 */
function loadFileConfig(
  configObj: object | null,
  envVars: Record<string, string> = {}
): FileConfigModule {
  let tmpFile: string | undefined;

  if (configObj !== null) {
    tmpFile = path.join(os.tmpdir(), `fileConfig-test-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(configObj), 'utf-8');
    process.env.NAMED_CONFIGS_FILE = tmpFile;
  } else {
    process.env.NAMED_CONFIGS_FILE = path.join(
      os.tmpdir(),
      'does-not-exist-fileconfig-test.json'
    );
  }

  for (const [k, v] of Object.entries(envVars)) {
    process.env[k] = v;
  }

  let mod!: FileConfigModule;

  // jest.isolateModules ensures the module is re-executed with the current env
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require('../../../../src/utils/fileConfig') as FileConfigModule;
  });

  // Cleanup env
  delete process.env.NAMED_CONFIGS_FILE;
  for (const k of Object.keys(envVars)) {
    delete process.env[k];
  }
  if (tmpFile && fs.existsSync(tmpFile)) {
    fs.unlinkSync(tmpFile);
  }

  return mod;
}

// ─── resolveEnvVars (tested indirectly via processNamedConfig) ─────────────────

describe('resolveEnvVars (via processNamedConfig)', () => {
  it('replaces $VAR placeholders with env variable values', () => {
    const { processNamedConfig } = loadFileConfig(
      { named_configs: { default: { provider: 'openai', api_key: '$OPENAI_KEY' } } },
      { OPENAI_KEY: 'sk-test-123' }
    );

    const result = JSON.parse(processNamedConfig(null) as string);
    expect(result.api_key).toBe('sk-test-123');
  });

  it('leaves placeholder untouched when env variable is not set', () => {
    const { processNamedConfig } = loadFileConfig({
      named_configs: { default: { provider: 'openai', api_key: '$MISSING_KEY' } },
    });

    const result = JSON.parse(processNamedConfig(null) as string);
    expect(result.api_key).toBe('$MISSING_KEY');
  });

  it('resolves placeholders in nested objects and arrays', () => {
    const { processNamedConfig } = loadFileConfig(
      {
        named_configs: {
          prod: {
            strategy: { mode: 'fallback' },
            targets: [
              { provider: 'openai', api_key: '$OPENAI_KEY' },
              { provider: 'anthropic', api_key: '$ANTHROPIC_KEY' },
            ],
          },
        },
      },
      { OPENAI_KEY: 'sk-openai', ANTHROPIC_KEY: 'sk-anthropic' }
    );

    const result = JSON.parse(processNamedConfig('prod') as string);
    expect(result.targets[0].api_key).toBe('sk-openai');
    expect(result.targets[1].api_key).toBe('sk-anthropic');
  });
});

// ─── namedConfig fallback to "default" ────────────────────────────────────────

describe('namedConfig – fallback to "default"', () => {
  it('returns the "default" config when name is null', () => {
    const { processNamedConfig } = loadFileConfig({
      named_configs: { default: { provider: 'ollama', custom_host: 'http://localhost:11434' } },
    });

    const result = JSON.parse(processNamedConfig(null) as string);
    expect(result.provider).toBe('ollama');
  });

  it('returns the "default" config when name is undefined', () => {
    const { processNamedConfig } = loadFileConfig({
      named_configs: { default: { provider: 'ollama', custom_host: 'http://localhost:11434' } },
    });

    const result = JSON.parse(processNamedConfig(undefined) as string);
    expect(result.provider).toBe('ollama');
  });

  it('returns the "default" config when name is an empty string', () => {
    const { processNamedConfig } = loadFileConfig({
      named_configs: { default: { provider: 'ollama', custom_host: 'http://localhost:11434' } },
    });

    const result = JSON.parse(processNamedConfig('') as string);
    expect(result.provider).toBe('ollama');
  });

  it('returns the named config when a specific name is given', () => {
    const { processNamedConfig } = loadFileConfig({
      named_configs: {
        default: { provider: 'ollama' },
        ollama_dev: { provider: 'ollama', custom_host: 'http://ollama-dev.example.com:11434' },
      },
    });

    const result = JSON.parse(processNamedConfig('ollama_dev') as string);
    expect(result.custom_host).toBe('http://ollama-dev.example.com:11434');
  });

  it('returns null when the requested name does not exist', () => {
    const { processNamedConfig } = loadFileConfig({
      named_configs: { default: { provider: 'ollama' } },
    });

    expect(processNamedConfig('nonexistent')).toBeNull();
  });

  it('returns null when "default" entry is missing and no name is given', () => {
    const { processNamedConfig } = loadFileConfig({
      named_configs: { ollama_local: { provider: 'ollama' } },
    });

    expect(processNamedConfig(null)).toBeNull();
  });
});

// ─── processNamedConfig – no config file ──────────────────────────────────────

describe('processNamedConfig – no config file', () => {
  it('returns null when the config file does not exist', () => {
    const { processNamedConfig } = loadFileConfig(null);
    expect(processNamedConfig(null)).toBeNull();
  });

  it('passes through the original config string when no file is present', () => {
    const { processNamedConfig } = loadFileConfig(null);
    const raw = '{"provider":"openai"}';
    expect(processNamedConfig(raw)).toBe(raw);
  });
});

// ─── NAMED_CONFIGS_FILE environment variable ──────────────────────────────────

describe('NAMED_CONFIGS_FILE environment variable', () => {
  it('loads config from the file path specified in NAMED_CONFIGS_FILE', () => {
    const { processNamedConfig } = loadFileConfig({
      named_configs: { default: { provider: 'anthropic', api_key: 'sk-ant' } },
    });

    const result = JSON.parse(processNamedConfig(null) as string);
    expect(result.provider).toBe('anthropic');
  });
});
