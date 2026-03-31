import { writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { resolveEnvVars } from '../../../../src/utils/fileConfig';

/**
 * Writes a temp config file, sets env vars, then loads fileConfig.ts in an
 * isolated module registry so its top-level side-effects re-execute.
 * Cleans up afterwards.
 */
function loadFileConfig(
  configObj: object | null,
  envVars: Record<string, string> = {}
) {
  let tmpFile: string | undefined;

  if (configObj !== null) {
    tmpFile = join(tmpdir(), `fileConfig-test-${Date.now()}.json`);
    writeFileSync(tmpFile, JSON.stringify(configObj), 'utf-8');
    process.env.NAMED_CONFIGS_FILE = tmpFile;
  } else {
    process.env.NAMED_CONFIGS_FILE = join(
      tmpdir(),
      'does-not-exist-fileconfig-test.json'
    );
  }

  for (const [k, v] of Object.entries(envVars)) {
    process.env[k] = v;
  }

  // Cleanup env
  delete process.env.NAMED_CONFIGS_FILE;
  for (const k of Object.keys(envVars)) {
    delete process.env[k];
  }
  if (tmpFile && existsSync(tmpFile)) {
    unlinkSync(tmpFile);
  }
}

// ─── resolveEnvVars ────────────────────────────────────────────────────────────

describe('resolveEnvVars', () => {
  it('replaces $VAR placeholders with env variable values', () => {
    process.env.OPENAI_KEY = 'sk-test-123';
    try {
      const input = { provider: 'openai', api_key: '$OPENAI_KEY' };
      const result = resolveEnvVars(input);
      expect(result.api_key).toBe('sk-test-123');
    } finally {
      delete process.env.OPENAI_KEY;
    }
  });

  it('leaves placeholder as-is when env variable is not set', () => {
    delete process.env.MISSING_VAR;
    const input = { key: '$MISSING_VAR' };
    const result = resolveEnvVars(input);
    expect(result.key).toBe('$MISSING_VAR');
  });

  it('handles nested objects', () => {
    process.env.MY_KEY = 'value123';
    try {
      const input = { outer: { inner: '$MY_KEY' } };
      const result = resolveEnvVars(input);
      expect(result.outer.inner).toBe('value123');
    } finally {
      delete process.env.MY_KEY;
    }
  });

  it('handles arrays', () => {
    process.env.ARRAY_VAR = 'hello';
    try {
      const input = ['$ARRAY_VAR', 'static'];
      const result = resolveEnvVars(input);
      expect(result[0]).toBe('hello');
      expect(result[1]).toBe('static');
    } finally {
      delete process.env.ARRAY_VAR;
    }
  });
});