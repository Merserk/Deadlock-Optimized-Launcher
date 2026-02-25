const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const ini = require('ini');
const os = require('os');
const { exec, spawn } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Path logic
let CONFIG_FILE;
const BIN_DIR = app.isPackaged ? path.join(process.resourcesPath, 'bin') : path.join(__dirname, 'bin');
const FD_EXE = path.join(BIN_DIR, 'fd.exe');
const RAMMAP_EXE = path.join(BIN_DIR, 'RAMMap64.exe');
const GAME_SHORTCUT_NAME = "Deadlock.url";

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 600,
        height: 790,
        icon: path.join(__dirname, 'icon.png'),
        frame: false,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        backgroundColor: '#0d0e15',
        show: false
    });

    mainWindow.loadFile('index.html');
    mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(() => {
    CONFIG_FILE = path.join(app.getPath('userData'), 'deadlock_launcher_config.ini');
    app.setAppUserModelId("com.optimizer.deadlock");
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// -- IPC Handlers --

ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-close', () => app.exit(0));
ipcMain.handle('open-external', async (event, url) => shell.openExternal(url));

// Sys Info
ipcMain.handle('get-sys-info', async () => {
    const totalMem = (os.totalmem() / (1024 ** 3)).toFixed(1);
    const freeMem = (os.freemem() / (1024 ** 3)).toFixed(1);
    return {
        osName: os.type() + ' ' + os.release(),
        totalRam: totalMem,
        availableRam: freeMem
    };
});

// Check Admin
ipcMain.handle('check-admin', async () => {
    try {
        await execPromise('fltmc');
        return true;
    } catch (error) {
        return false;
    }
});

// Config
ipcMain.handle('load-config', () => {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const config = ini.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            return config;
        }
    } catch (error) {
        console.error("Config load error", error);
    }
    return { LauncherPath: null };
});

ipcMain.handle('save-config', (event, config) => {
    try {
        fs.writeFileSync(CONFIG_FILE, ini.stringify(config));
        return true;
    } catch (error) {
        console.error("Config save error", error);
        return false;
    }
});

// Constants for default Desktop paths
const DEFAULT_DESKTOP_PATHS = [
    path.join(process.env.USERPROFILE || 'C:\\Users\\Default', 'Desktop', GAME_SHORTCUT_NAME),
    path.join(process.env.USERPROFILE || 'C:\\Users\\Default', 'OneDrive', 'Desktop', GAME_SHORTCUT_NAME),
    path.join('C:', 'Users', 'Public', 'Desktop', GAME_SHORTCUT_NAME)
];

async function checkFastPaths(pathsArr) {
    for (const p of pathsArr) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

// Robust fallback search using fd.exe
async function exhaustiveSearch(filename) {
    try {
        const { stdout: wmicOut } = await execPromise('wmic logicaldisk where "DriveType=3" get DeviceID');
        const drives = wmicOut.split('\n').map(d => d.trim()).filter(d => d.match(/^[A-Z]:/)).map(d => d + '\\');
        if (drives.length === 0) drives.push('C:\\');

        for (const drive of drives) {
            try {
                // Use execFile to bypass powershell entirely
                const execFilePromise = util.promisify(require('child_process').execFile);
                const { stdout } = await execFilePromise(FD_EXE, ['-u', '--max-results', '1', filename, drive]);
                const results = stdout.split('\n').map(s => s.trim()).filter(s => s && s.toLowerCase().endsWith(filename.toLowerCase()) && !s.toLowerCase().includes('\\prefetch\\'));
                if (results.length > 0) return results[0];
            } catch (e) {
                if (e.stdout) {
                    const results = e.stdout.split('\n').map(s => s.trim()).filter(s => s && s.toLowerCase().endsWith(filename.toLowerCase()) && !s.toLowerCase().includes('\\prefetch\\'));
                    if (results.length > 0) return results[0];
                }
            }
        }
    } catch (e) {
        console.error("Exhaustive search error", e);
    }
    return null;
}

ipcMain.handle('find-launcher', async () => {
    // 1. Check default desktop locations first (instantly)
    let fast = await checkFastPaths(DEFAULT_DESKTOP_PATHS);
    if (fast) return fast;

    // 2. Fallback to exhaustive drive scan
    return await exhaustiveSearch(GAME_SHORTCUT_NAME);
});

// Dialogs
ipcMain.handle('select-manual-launcher', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Deadlock Shortcut (.url or .lnk)',
        filters: [{ name: 'Shortcuts', extensions: ['url', 'lnk'] }],
        properties: ['openFile']
    });
    return result.canceled ? null : result.filePaths[0];
});

// Optimization
ipcMain.handle('optimize-ram', async () => {
    try {
        const initialMem = Math.round(os.freemem() / (1024 * 1024));
        const args = ['-ew', '-es', '-em', '-et', '-e0'];
        const steps = [
            "Emptying Working Sets...",
            "Clearing System Working Sets...",
            "Emptying Modified Page List...",
            "Clearing Standby List...",
            "Emptying Priority 0 Standby List..."
        ];

        for (let i = 0; i < args.length; i++) {
            mainWindow.webContents.send('launch-progress', { step: steps[i], progress: (i / args.length) * 100 });
            await execPromise(`"${RAMMAP_EXE}" -accepteula ${args[i]}`);
            await new Promise(resolve => setTimeout(resolve, 600)); // Added delay between steps
        }

        // Give os.freemem a moment to reflect the clearing
        await new Promise(resolve => setTimeout(resolve, 500));
        const finalMem = Math.round(os.freemem() / (1024 * 1024));
        const freed = Math.max(0, finalMem - initialMem);

        mainWindow.webContents.send('launch-progress', { step: "Optimization Complete", progress: 100, freed });
        return { success: true, freed };
    } catch (error) {
        console.error("Optimization error", error);
        return { success: false, error: error.message };
    }
});

// Launch logic
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

                ps.on('close', () => {
                    resolve(true);
                });
            });
        }

        return true;
    } catch (error) {
        console.error("Launch error", error);
        return false;
    }
});
