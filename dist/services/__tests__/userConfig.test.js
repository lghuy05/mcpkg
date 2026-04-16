import test from 'node:test';
import assert from 'node:assert/strict';
import { getUserConfigDirForPlatform } from '../userConfig.js';
test('uses Application Support on macOS', () => {
    assert.equal(getUserConfigDirForPlatform('darwin', {}, '/Users/alice'), '/Users/alice/Library/Application Support/mcpkg');
});
test('uses XDG_CONFIG_HOME on Linux when present', () => {
    assert.equal(getUserConfigDirForPlatform('linux', { XDG_CONFIG_HOME: '/tmp/config' }, '/home/alice'), '/tmp/config/mcpkg');
});
test('falls back to ~/.config on Linux', () => {
    assert.equal(getUserConfigDirForPlatform('linux', {}, '/home/alice'), '/home/alice/.config/mcpkg');
});
test('uses APPDATA on Windows when present', () => {
    assert.equal(getUserConfigDirForPlatform('win32', { APPDATA: 'C:\\Users\\Alice\\AppData\\Roaming' }, 'C:\\Users\\Alice'), 'C:\\Users\\Alice\\AppData\\Roaming/mcpkg');
});
