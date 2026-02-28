const { ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const os = require('os');
const { exec, spawn } = require('child_process');
const util = require('util');

const { loadConfig, saveConfig } = require('./config');
const { findLauncher } = require('./search');
const { optimizeRam } = require('./memory');

const execPromise = util.promisify(exec);

function registerIpcHandlers({ app, getMainWindow }) {
    if (!app || typeof getMainWindow !== 'function') {
        throw new Error('registerIpcHandlers requires app and getMainWindow.');
    }

    ipcMain.on('window-minimize', () => {
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.minimize();
        }
    });

    ipcMain.on('window-close', () => app.exit(0));

    ipcMain.handle('open-external', async (event, url) => shell.openExternal(url));

    ipcMain.handle('get-sys-info', async () => {
        const totalMem = (os.totalmem() / (1024 ** 3)).toFixed(1);
        const freeMem = (os.freemem() / (1024 ** 3)).toFixed(1);
        return {
            osName: `${os.type()} ${os.release()}`,
            totalRam: totalMem,
            availableRam: freeMem
        };
    });

    ipcMain.handle('check-admin', async () => {
        try {
            await execPromise('fltmc');
            return true;
        } catch {
            return false;
        }
    });

    ipcMain.handle('load-config', () => loadConfig(app));
    ipcMain.handle('save-config', (event, config) => saveConfig(app, config));

    ipcMain.handle('find-launcher', async () => findLauncher());

    ipcMain.handle('select-manual-launcher', async () => {
        const mainWindow = getMainWindow();
        const ownerWindow = (mainWindow && !mainWindow.isDestroyed()) ? mainWindow : undefined;
        const result = await dialog.showOpenDialog(ownerWindow, {
            title: 'Select Deadlock Shortcut (.url or .lnk)',
            filters: [{ name: 'Shortcuts', extensions: ['url', 'lnk'] }],
            properties: ['openFile']
        });
        return result.canceled ? null : result.filePaths[0];
    });

    ipcMain.handle('optimize-ram', async () => optimizeRam(getMainWindow()));

    ipcMain.handle('launch-game', async (event, launcherPath, disableSMT, highPriority) => {
        try {
            if (!fs.existsSync(launcherPath)) {
                throw new Error(`Shortcut missing: ${launcherPath}`);
            }

            const error = await shell.openPath(launcherPath);
            if (error) {
                throw new Error(`Failed to open shortcut: ${error}`);
            }

            if (disableSMT || highPriority) {
                const script = `
$procNames = @("deadlock", "project8");
$timeout = 60;
$sw = [Diagnostics.Stopwatch]::StartNew();
$process = $null;

while ($sw.Elapsed.TotalSeconds -lt $timeout) {
    foreach ($name in $procNames) {
        $process = Get-Process -Name $name -ErrorAction SilentlyContinue | Select-Object -First 1;
        if ($process) { break; }
    }
    if ($process) { break; }
    Start-Sleep -Milliseconds 500;
}

if (-not $process) { exit; }

if ("${highPriority}" -eq "true") {
    try { $process.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::High; } catch {}
}

if ("${disableSMT}" -eq "true") {
    try {
        $logicalCores = (Get-CimInstance -ClassName Win32_Processor | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum;
        if (-not $logicalCores) { $logicalCores = [Environment]::ProcessorCount; }
        $mask = [long]0;
        for ($i = 0; $i -lt $logicalCores; $i += 2) {
            $mask += [long][Math]::Pow(2, $i);
        }
        $process.ProcessorAffinity = [System.IntPtr][long]$mask;
    } catch {}
}
`;
                return new Promise((resolve) => {
                    const ps = spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', script], {
                        stdio: 'ignore'
                    });
                    ps.on('close', () => resolve(true));
                });
            }

            return true;
        } catch (launchError) {
            console.error('Launch error', launchError);
            return false;
        }
    });
}

module.exports = {
    registerIpcHandlers
};