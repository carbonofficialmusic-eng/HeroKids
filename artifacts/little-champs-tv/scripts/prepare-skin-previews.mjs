import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Read shared originals, but write exclusively inside the TV artifact.
const sourceRoot = fileURLToPath(new URL('../../little-champs/public/skins/', import.meta.url));
const outputRoot = fileURLToPath(new URL('../public/skin-previews/', import.meta.url));
const manifestPath = path.join(outputRoot, 'manifest.json');
const recipe = {
  avatars: { resize: '256x256>', quality: 82 },
  backgrounds: { resize: '384x216>', quality: 80 },
};
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');

function sourceFiles() {
  return Object.keys(recipe).flatMap(kind =>
    readdirSync(path.join(sourceRoot, kind)).filter(name => name.endsWith('.png')).sort().map(name => {
      const id = name.slice(0, -4);
      if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Invalid skin identifier: ${id}`);
      return { kind, key: `${kind}/${id}.webp`, source: path.join(sourceRoot, kind, name) };
    }));
}

function readManifest() {
  return existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
}

function check() {
  const files = sourceFiles();
  const manifest = readManifest();
  if (!files.length || !manifest || JSON.stringify(manifest.recipe) !== JSON.stringify(recipe)) {
    throw new Error('Missing or outdated TV skin previews. Run node scripts/prepare-skin-previews.mjs in the TV artifact.');
  }
  for (const file of files) {
    const target = path.join(outputRoot, file.key);
    const entry = manifest.files[file.key];
    if (!existsSync(target) || !entry || entry.sourceSha256 !== sha256(file.source) || entry.previewSha256 !== sha256(target)) {
      throw new Error(`Missing or outdated TV preview: ${file.key}. Regenerate TV previews; never replace the shared originals.`);
    }
  }
  if (Object.keys(manifest.files).length !== files.length) throw new Error('TV preview manifest contains stale skin entries.');
  console.log(`Verified ${files.length} TV-only skin previews; shared Web/iOS originals untouched.`);
}

function convert(file) {
  return new Promise((resolve, reject) => {
    const target = path.join(outputRoot, file.key);
    const temporary = `${target}.tmp.webp`;
    const spec = recipe[file.kind];
    const child = spawn('magick', [file.source, '-resize', spec.resize, '-strip', '-quality', String(spec.quality), temporary], {
      env: { ...process.env, MAGICK_THREAD_LIMIT: '1' },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) { reject(new Error(`TV preview conversion failed for ${file.key}: ${stderr}`)); return; }
      renameSync(temporary, target);
      resolve();
    });
  });
}

async function generate() {
  const files = sourceFiles();
  if (!files.length) throw new Error('No source skins found.');
  const previous = readManifest();
  const sameRecipe = previous && JSON.stringify(previous.recipe) === JSON.stringify(recipe);
  const manifest = { recipe, files: {} };
  for (const kind of Object.keys(recipe)) mkdirSync(path.join(outputRoot, kind), { recursive: true });
  let next = 0;
  // Bound conversion CPU/memory use on the build machine.
  await Promise.all([0, 1].map(async () => {
    while (next < files.length) {
      const file = files[next++];
      const target = path.join(outputRoot, file.key);
      const sourceSha256 = sha256(file.source);
      const old = previous?.files?.[file.key];
      if (!(sameRecipe && old?.sourceSha256 === sourceSha256 && existsSync(target) && old.previewSha256 === sha256(target))) {
        await convert(file);
      }
      manifest.files[file.key] = { sourceSha256, previewSha256: sha256(target) };
    }
  }));
  // Only remove obsolete generated TV previews, never any shared artwork.
  const expected = new Set(files.map(file => file.key));
  for (const kind of Object.keys(recipe)) {
    for (const name of readdirSync(path.join(outputRoot, kind))) {
      if (name.endsWith('.webp') && !expected.has(`${kind}/${name}`)) unlinkSync(path.join(outputRoot, kind, name));
    }
  }
  manifest.files = Object.fromEntries(Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  check();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes('--check')) check();
    else await generate();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}