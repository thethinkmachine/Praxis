import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FALLBACK_DEMO_PROBLEMS } from '@/components/editor/DemoProblemPicker';
import { isDemoManifest } from '@/lib/demo-manifest';

describe('demo manifest', () => {
  const demoDir = resolve(process.cwd(), 'public/problems/graphs');
  const demoFiles = new Set(readdirSync(demoDir).filter((file) => file.endsWith('.json')));

  it('matches the expected manifest shape', () => {
    const manifest = JSON.parse(readFileSync(resolve(demoDir, '_manifest.json'), 'utf8'));
    expect(isDemoManifest(manifest)).toBe(true);
  });

  it('only references fallback demos that exist on disk', () => {
    for (const demos of Object.values(FALLBACK_DEMO_PROBLEMS)) {
      for (const demo of demos) {
        expect(demoFiles.has(demo.id)).toBe(true);
      }
    }
  });
});
