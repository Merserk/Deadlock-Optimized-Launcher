const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);
const GAME_SHORTCUT_NAME = 'Deadlock.url';

function getDefaultDesktopPaths() {
    return [
        path.join(process.env.USERPROFILE || 'C:\\Users\\Default', 'Desktop', GAME_SHORTCUT_NAME),
        path.join(process.env.USERPROFILE || 'C:\\Users\\Default', 'OneDrive', 'Desktop', GAME_SHORTCUT_NAME),
        path.join('C:', 'Users', 'Public', 'Desktop', GAME_SHORTCUT_NAME)
    ];
}

async function checkFastPaths(pathsArr) {
    for (const targetPath of pathsArr) {
        if (fs.existsSync(targetPath)) return targetPath;
    }
    return null;
}

const SKIP_DIR_NAMES = new Set([
    '$recycle.bin',
    'system volume information',
    'prefetch'
]);

function findFileRecursiveSync(rootPath, filename) {
    const targetName = filename.toLowerCase();
    const stack = [rootPath];
    const seen = new Set();

    while (stack.length > 0) {
        const currentDir = stack.pop();
        const normalizedDir = currentDir.toLowerCase();
        if (seen.has(normalizedDir)) continue;
        seen.add(normalizedDir);

        let entries;
        try {
            entries = fs.readdirSync(currentDir, { withFileTypes: true });
        } catch {
            continue;
        }

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);

            if (entry.isFile()) {
                if (entry.name.toLowerCase() === targetName && !fullPath.toLowerCase().includes('\\prefetch\\')) {
                    return fullPath;
                }
                continue;
            }

            if (entry.isSymbolicLink()) continue;
            if (!entry.isDirectory()) continue;
            if (SKIP_DIR_NAMES.has(entry.name.toLowerCase())) continue;

            stack.push(fullPath);
        }
    }

    return null;
}

async function getFixedDrives() {
    try {
        const psCommand = `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Get-CimInstance -ClassName Win32_LogicalDisk -Filter \\"DriveType=3\\" | Select-Object -ExpandProperty DeviceID"`;
        const { stdout } = await execPromise(psCommand);
        const drives = stdout
            .split('\n')
            .map(d => d.trim())
            .filter(d => /^[A-Z]:$/i.test(d))
            .map(d => `${d}\\`);

        if (drives.length > 0) return drives;
    } catch (error) {
        console.error('Drive detection via PowerShell CIM failed, using fallback scan.', error);
    }

    const fallbackDrives = [];
    for (let code = 67; code <= 90; code++) {
        const drive = `${String.fromCharCode(code)}:\\`;
        if (fs.existsSync(drive)) fallbackDrives.push(drive);
    }

    return fallbackDrives.length > 0 ? fallbackDrives : ['C:\\'];
}

async function exhaustiveSearch(filename) {
    try {
        const drives = await getFixedDrives();
        for (const drive of drives) {
            const foundPath = findFileRecursiveSync(drive, filename);
            if (foundPath) return foundPath;
        }
    } catch (error) {
        console.error('Exhaustive search error', error);
    }
    return null;
}

async function findLauncher() {
    const fast = await checkFastPaths(getDefaultDesktopPaths());
    if (fast) return fast;
    return exhaustiveSearch(GAME_SHORTCUT_NAME);
}

module.exports = {
    GAME_SHORTCUT_NAME,
    checkFastPaths,
    exhaustiveSearch,
    findFileRecursiveSync,
    findLauncher,
    getDefaultDesktopPaths,
    getFixedDrives
};