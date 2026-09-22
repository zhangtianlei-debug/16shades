import { execFileSync } from 'node:child_process';
import { sourceFingerprint } from './release-files.mjs';

// Capture inputs before compilation. A standalone postbuild cannot bless an
// older dist after source changes, and edits during compilation fail the build.
const fingerprint = sourceFingerprint();
execFileSync(process.execPath, ['node_modules/vinext/dist/cli.js', 'build'], {
  stdio: 'inherit',
});
// prepare-static rechecks this fingerprint before touching the build output.
// Keep the post-compilation check there instead of hashing twice in succession.
execFileSync(process.execPath, ['scripts/prepare-static.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, SHADOW16_BUILD_FINGERPRINT: fingerprint },
});
