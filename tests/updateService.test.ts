import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSemver, compareSemver, updateService } from '../server/updateService';

describe('Update Service & SemVer Test Suite', () => {
  it('should parse valid semver strings correctly', () => {
    assert.deepEqual(parseSemver('v0.1.0'), [0, 1, 0]);
    assert.deepEqual(parseSemver('1.2.3'), [1, 2, 3]);
    assert.deepEqual(parseSemver('v2.10.4-beta'), [2, 10, 4]);
    assert.deepEqual(parseSemver(''), [0, 0, 0]);
  });

  it('should compare semver versions correctly', () => {
    // Current < Latest -> returns 1 (update available)
    assert.equal(compareSemver('0.1.0', '0.2.0'), 1);
    assert.equal(compareSemver('0.1.0', '1.0.0'), 1);
    assert.equal(compareSemver('0.1.0', '0.1.1'), 1);
    assert.equal(compareSemver('v0.1.0', 'v0.2.5'), 1);

    // Current == Latest -> returns 0 (up-to-date)
    assert.equal(compareSemver('0.1.0', '0.1.0'), 0);
    assert.equal(compareSemver('v1.2.3', '1.2.3'), 0);

    // Current > Latest -> returns -1 (ahead/dev version)
    assert.equal(compareSemver('0.2.0', '0.1.0'), -1);
    assert.equal(compareSemver('1.0.0', '0.9.9'), -1);
    assert.equal(compareSemver('0.1.5', '0.1.4'), -1);
  });

  it('should retrieve current system version info without crashing', () => {
    const info = updateService.getSystemVersion();
    assert.ok(info.version, 'Version must be defined');
    assert.ok(info.nodeVersion, 'Node version must be defined');
    assert.ok(info.platform, 'Platform must be defined');
    assert.ok(info.arch, 'Arch must be defined');
  });
});
