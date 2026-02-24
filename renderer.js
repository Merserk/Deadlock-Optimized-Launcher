document.addEventListener('DOMContentLoaded', async () => {
    // Window controls
    document.getElementById('btn-minimize').addEventListener('click', () => window.api.minimize());
    document.getElementById('btn-close').addEventListener('click', () => window.api.close());

    // Elements
    const osNameEl = document.getElementById('os-name');
    const totalRamEl = document.getElementById('total-ram');
    const availableRamEl = document.getElementById('available-ram');

    const statusAdmin = document.getElementById('status-admin');
    const statusConfig = document.getElementById('status-config');
    const launchActions = document.getElementById('launch-actions');

    const platformPathInput = document.getElementById('platform-path');
    const btnStart = document.getElementById('btn-start');
    const logOutput = document.getElementById('log-output');

    let config = { LauncherPath: null };
    const log = (msg, type = '') => {
        const el = document.createElement('div');
        el.className = `log-line`;
        el.innerHTML = `> <span class="${type}">${msg}</span>`;
        logOutput.appendChild(el);
        logOutput.scrollTop = logOutput.scrollHeight;
    };

    // 1. Sys Info (Live Updated)
    const initSysInfo = async () => {
        const sysInfo = await window.api.getSysInfo();
        totalRamEl.textContent = `${sysInfo.totalRam} GB`;
        availableRamEl.textContent = `${sysInfo.availableRam} GB`;
    };

    await initSysInfo();
    let sysInfoInterval = setInterval(initSysInfo, 1000);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            clearInterval(sysInfoInterval);
        } else {
            initSysInfo();
            sysInfoInterval = setInterval(initSysInfo, 1000);
        }
    });

    // 2. Check Admin
    const isAdmin = await window.api.checkAdmin();
    if (isAdmin) {
        statusAdmin.querySelector('.status-icon').className = 'status-icon success';
        statusAdmin.querySelector('.status-text').textContent = 'Administrator Privileges Confirmed';
    } else {
        statusAdmin.querySelector('.status-icon').className = 'status-icon error';
        statusAdmin.querySelector('.status-text').textContent = 'ACCESS DENIED: Please Run as Administrator';
        statusAdmin.querySelector('.status-text').style.color = 'var(--danger)';
        return; // Stop initialization
    }

    // 3. Load Config
    config = await window.api.loadConfig();
    if (config.LauncherPath) {
        statusConfig.querySelector('.status-icon').className = 'status-icon success';
        statusConfig.querySelector('.status-text').textContent = 'Configuration Loaded Successfully';
        platformPathInput.value = config.LauncherPath;
    } else {
        statusConfig.querySelector('.status-icon').className = 'status-icon warning';
        statusConfig.querySelector('.status-text').textContent = 'No Configuration Found. Please set paths.';
    }

    launchActions.style.display = 'block';
    checkReady();

    // 4. Interactive Path Logic
    async function handleFind() {
        log(`Searching for Deadlock Launcher across all drives...`, 'info');
        document.getElementById(`btn-find-launcher`).disabled = true;

        const result = await window.api.findLauncher();
        if (result) {
            log(`Found Launcher at: ${result}`, 'success');
            config.LauncherPath = result;
            platformPathInput.value = result;
            await window.api.saveConfig(config);
            checkReady();
        } else {
            log(`Failed to find Launcher automatically. Please use manual selection.`, 'error');
        }
        document.getElementById(`btn-find-launcher`).disabled = false;
    }

    async function handleManual() {
        const result = await window.api.selectManualLauncher();
        if (result) {
            log(`Manually selected Launcher: ${result}`, 'success');
            config.LauncherPath = result;
            platformPathInput.value = result;
            await window.api.saveConfig(config);
            checkReady();
        }
    }

    document.getElementById('btn-find-launcher').addEventListener('click', () => handleFind());
    document.getElementById('btn-manual-launcher').addEventListener('click', () => handleManual());

    function checkReady() {
        if (config.LauncherPath) {
            btnStart.disabled = false;
            log('Ready to optimize and launch.', 'success');
        } else {
            btnStart.disabled = true;
        }
    }

    // 5. Optimization & Launch Flow
    btnStart.addEventListener('click', async () => {
        btnStart.disabled = true;
        log('Starting sequence...', 'info');

        // Show Overlay
        const overlay = document.getElementById('launch-overlay');
        const progressBar = document.getElementById('launch-progress');
        const overlayStatus = document.getElementById('overlay-status');
        const ramFreedSection = document.getElementById('ram-freed');
        const ramFreedAmount = document.getElementById('ram-freed-amount');
        const overlayTitle = document.getElementById('overlay-title');

        overlay.classList.add('active');

        // Register progress listener
        window.api.removeAllListeners('launch-progress');
        window.api.onLaunchProgress((data) => {
            progressBar.style.width = `${data.progress}%`;
            overlayStatus.textContent = data.step;
            log(`Optimization step: ${data.step}`, 'info');
        });

        log('Optimizing RAM using RAMMap64...', 'warning');
        const optResult = await window.api.optimizeRAM();

        if (optResult.success) {
            log(`Optimization complete. Freed ${optResult.freed} MB of RAM.`, 'success');
            ramFreedAmount.textContent = optResult.freed;
            ramFreedSection.style.display = 'block';
        } else {
            log(`Optimization failed: ${optResult.error}`, 'error');
            overlayStatus.textContent = "Optimization Failed (See Log)";
            overlayStatus.style.color = "var(--danger)";
            setTimeout(() => { overlay.classList.remove('active'); btnStart.disabled = false; }, 3000);
            return;
        }

        // Refresh UI RAM
        const newInfo = await window.api.getSysInfo();
        availableRamEl.textContent = `${newInfo.availableRam} GB`;

        // Wait 2s to show success
        await new Promise(r => setTimeout(r, 2000));

        // Launch Sequence
        overlayTitle.textContent = "LAUNCHING";
        progressBar.style.width = '0%';
        overlayStatus.textContent = "Starting Platform Launcher...";
        ramFreedSection.style.display = 'none';

        log(`Launching Platform: ${config.LauncherPath}`, 'highlight');

        // Animate progress to 50%
        setTimeout(() => progressBar.style.width = '50%', 100);

        const launched = await window.api.launchGame(config.LauncherPath);

        if (launched) {
            progressBar.style.width = '100%';
            overlayStatus.textContent = "Deadlock is running!";
            overlayStatus.classList.add('success-text');
            log(`Game Launch Command Executed.`, 'success');

            // Auto close after 5s
            let countdown = 5;
            const interval = setInterval(() => {
                countdown--;
                if (countdown <= 0) {
                    clearInterval(interval);
                    window.api.close();
                } else {
                    overlayStatus.textContent = `Deadlock is running! Closing in ${countdown}s...`;
                }
            }, 1000);
        } else {
            overlayStatus.textContent = "Launch Error. See Logs.";
            overlayStatus.style.color = "var(--danger)";
            log(`Failed to launch executables.`, 'error');
            setTimeout(() => { overlay.classList.remove('active'); btnStart.disabled = false; }, 3000);
        }
    });

    // Author Link
    const authorLink = document.getElementById('author-link');
    if (authorLink) {
        authorLink.addEventListener('click', () => {
            window.api.openExternal('https://gamebanana.com/members/5253470');
        });
    }

    // Info Modal
    const infoBtn = document.getElementById('btn-info');
    const infoOverlay = document.getElementById('info-overlay');
    const btnCloseInfo = document.getElementById('btn-close-info');

    if (infoBtn && infoOverlay && btnCloseInfo) {
        infoBtn.addEventListener('click', () => {
            infoOverlay.classList.add('active');
        });

        btnCloseInfo.addEventListener('click', () => {
            infoOverlay.classList.remove('active');
        });
    }

    // Tabs
    const navLauncher = document.getElementById('nav-launcher');
    const navAbout = document.getElementById('nav-about');
    const tabLauncher = document.getElementById('tab-launcher');
    const tabAbout = document.getElementById('tab-about');

    if (navLauncher && navAbout && tabLauncher && tabAbout) {
        navLauncher.addEventListener('click', (e) => {
            e.preventDefault();
            navLauncher.classList.add('active');
            navAbout.classList.remove('active');
            tabLauncher.style.display = 'block';
            tabAbout.style.display = 'none';
        });

        navAbout.addEventListener('click', (e) => {
            e.preventDefault();
            navAbout.classList.add('active');
            navLauncher.classList.remove('active');
            tabAbout.style.display = 'block';
            tabLauncher.style.display = 'none';
        });
    }
});
