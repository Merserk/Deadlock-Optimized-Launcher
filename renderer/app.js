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

    const cbDisableSmt = document.getElementById('cb-disable-smt');
    const cbHighPriority = document.getElementById('cb-high-priority');

    const statLaunchesEl = document.getElementById('stat-launches');
    const statRamEl = document.getElementById('stat-ram');

    let config = {
        LauncherPath: null,
        DisableSMT: false,
        HighPriority: false,
        TotalLaunches: 0,
        TotalRamFreedMB: 0
    };
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

    // Set checkbox states from config (default to false if not present)
    cbDisableSmt.checked = config.DisableSMT === true || config.DisableSMT === 'true';
    cbHighPriority.checked = config.HighPriority === true || config.HighPriority === 'true';

    // Normalize stats
    config.TotalLaunches = parseInt(config.TotalLaunches) || 0;
    config.TotalRamFreedMB = parseInt(config.TotalRamFreedMB) || 0;

    // Draw Stats
    statLaunchesEl.textContent = config.TotalLaunches;
    if (config.TotalRamFreedMB >= 1024) {
        statRamEl.textContent = `${(config.TotalRamFreedMB / 1024).toFixed(1)} GB`;
    } else {
        statRamEl.textContent = `${config.TotalRamFreedMB} MB`;
    }

    // Event listeners to save checkbox state
    const saveSettings = async () => {
        config.DisableSMT = cbDisableSmt.checked;
        config.HighPriority = cbHighPriority.checked;
        await window.api.saveConfig(config);
    };
    cbDisableSmt.addEventListener('change', saveSettings);
    cbHighPriority.addEventListener('change', saveSettings);

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

        log('Optimizing RAM using native Windows API...', 'warning');
        const optResult = await window.api.optimizeRAM();

        if (optResult.success) {
            log(`Optimization complete. Freed ${optResult.freed} MB of RAM.`, 'success');
            if (Array.isArray(optResult.warnings) && optResult.warnings.length > 0) {
                for (const warning of optResult.warnings) {
                    log(`Optimization warning: ${warning}`, 'warning');
                }
            }
            ramFreedAmount.textContent = optResult.freed;
            ramFreedSection.style.display = 'block';

            // Tally RAM
            config.TotalRamFreedMB += optResult.freed;
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
        if (cbDisableSmt.checked || cbHighPriority.checked) {
            overlayStatus.textContent = "Starting Platform... Waiting for Deadlock to apply settings...";
        } else {
            overlayStatus.textContent = "Starting Platform Launcher...";
        }
        ramFreedSection.style.display = 'none';

        log(`Launching Platform: ${config.LauncherPath}`, 'highlight');

        // Animate progress to 50%
        setTimeout(() => progressBar.style.width = '50%', 100);

        const launched = await window.api.launchGame(config.LauncherPath, cbDisableSmt.checked, cbHighPriority.checked);

        if (launched) {
            progressBar.style.width = '100%';

            // Tally Launch & Save Config
            config.TotalLaunches += 1;
            await window.api.saveConfig(config);

            // Draw Stats
            statLaunchesEl.textContent = config.TotalLaunches;
            if (config.TotalRamFreedMB >= 1024) {
                statRamEl.textContent = `${(config.TotalRamFreedMB / 1024).toFixed(1)} GB`;
            } else {
                statRamEl.textContent = `${config.TotalRamFreedMB} MB`;
            }

            if (cbDisableSmt.checked || cbHighPriority.checked) {
                overlayStatus.textContent = "Settings Applied! Deadlock is running!";
            } else {
                overlayStatus.textContent = "Deadlock is running!";
            }
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
                    if (cbDisableSmt.checked || cbHighPriority.checked) {
                        overlayStatus.textContent = `Settings Applied! Closing in ${countdown}s...`;
                    } else {
                        overlayStatus.textContent = `Deadlock is running! Closing in ${countdown}s...`;
                    }
                }
            }, 1000);
        } else {
            overlayStatus.textContent = "Launch Error. See Logs.";
            overlayStatus.style.color = "var(--danger)";
            log(`Failed to launch executables.`, 'error');
            setTimeout(() => { overlay.classList.remove('active'); btnStart.disabled = false; }, 3000);
        }
    });

    // 6. Reset Stats
    const btnResetStats = document.getElementById('btn-reset-stats');
    if (btnResetStats) {
        btnResetStats.addEventListener('click', async () => {
            config.TotalLaunches = 0;
            config.TotalRamFreedMB = 0;
            await window.api.saveConfig(config);
            statLaunchesEl.textContent = '0';
            statRamEl.textContent = '0 MB';
            log('Statistics have been reset to 0.', 'warning');
        });
    }

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
    const navAdditional = document.getElementById('nav-additional');
    const navStatistics = document.getElementById('nav-statistics');
    const navAbout = document.getElementById('nav-about');

    const tabLauncher = document.getElementById('tab-launcher');
    const tabAdditional = document.getElementById('tab-additional');
    const tabStatistics = document.getElementById('tab-statistics');
    const tabAbout = document.getElementById('tab-about');

    if (navLauncher && navAbout && tabLauncher && tabAbout && navAdditional && tabAdditional && navStatistics && tabStatistics) {
        const switchTab = (activeNav, activeTab) => {
            [navLauncher, navAdditional, navStatistics, navAbout].forEach(n => n.classList.remove('active'));
            [tabLauncher, tabAdditional, tabStatistics, tabAbout].forEach(t => t.style.display = 'none');

            activeNav.classList.add('active');
            activeTab.style.display = 'block';
        };

        navLauncher.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(navLauncher, tabLauncher);
        });

        navAdditional.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(navAdditional, tabAdditional);
        });

        navStatistics.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(navStatistics, tabStatistics);
        });

        navAbout.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(navAbout, tabAbout);
        });
    }

    if (typeof window.initEasterEgg === "function") {
        window.initEasterEgg();
    }
});