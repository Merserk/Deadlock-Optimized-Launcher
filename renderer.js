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

        log('Optimizing RAM using RAMMap64...', 'warning');
        const optResult = await window.api.optimizeRAM();

        if (optResult.success) {
            log(`Optimization complete. Freed ${optResult.freed} MB of RAM.`, 'success');
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

    // --- Bouncing Ball Easter Egg ---
    const logoIcon = document.querySelector('.logo-icon');
    let ballActive = false;
    let ballEl = null;
    let animationId = null;
    let ballX = 0;
    let ballY = 0;
    let ballVx = 0;
    let ballVy = 0;
    const ballSize = 35; // Increased ball size

    // Physics constants
    const gravity = 0.3; // Slower, floatier gravity for when no targets remain
    const maxSpeed = 15; // Lower overall speed
    const turnRate = 0.06; // Homing missile turning ability

    let timeScale = 1.0; // Controls dynamic speed slowdown/ramp-up
    let currentTarget = null;

    // Trail settings
    let lastTrailTime = 0;
    const trailInterval = 15; // Faster trail particle spawning for smoothness

    let lastHitElement = null; // Track the most recently hit element

    const collidableSelectors = ['.nav-link', '.btn-primary', '.btn-apply', '.setting-control', '.status-item', '.setting-label', '.panel-title', '.toggle-row'];

    if (logoIcon) {
        logoIcon.addEventListener('click', () => {
            if (!ballActive) {
                // Check if we are in the "retained damage" state after an organic end
                const hasDamage = document.querySelectorAll('.damaged-1, .damaged-2, .damaged-3, .damaged').length > 0;

                if (hasDamage) {
                    // If damage exists, clicking the logo only clears the damage. It doesn't spawn the ball.
                    resetDamage();
                } else {
                    // If the board is clean, clicking the logo spawns the ball.
                    resetDamage();
                    startBouncingBall();
                }
            } else {
                // Clicking again during animation stops it and CANCELS the damage (resetting the UI)
                resetDamage();
                stopBouncingBall();
            }
        });
    }

    function resetDamage() {
        document.querySelectorAll('.damaged-1, .damaged-2, .damaged-3, .damaged').forEach(el => {
            el.classList.remove('damaged-1', 'damaged-2', 'damaged-3', 'damaged');
            el.dataset.hits = 0;
        });
        lastHitElement = null;
    }

    function startBouncingBall() {
        ballActive = true;
        if (!document.getElementById('bouncing-ball')) {
            ballEl = document.createElement('div');
            ballEl.id = 'bouncing-ball';
            document.body.appendChild(ballEl);
        } else {
            ballEl = document.getElementById('bouncing-ball');
        }

        ballEl.style.display = 'block';

        const logoRect = logoIcon.getBoundingClientRect();
        ballX = logoRect.left + logoRect.width / 2 - ballSize / 2;
        ballY = logoRect.top + logoRect.height / 2 - ballSize / 2;

        pickTarget();
        updateBall();
    }

    function stopBouncingBall(retainDamage = false) {
        ballActive = false;
        if (ballEl) {
            ballEl.style.display = 'none';
        }
        cancelAnimationFrame(animationId);

        // Clean up trail particles
        document.querySelectorAll('.ball-trail').forEach(el => el.remove());
        document.querySelectorAll('.ball-sparkle').forEach(el => el.remove());

        if (!retainDamage) {
            resetDamage();
        }
    }

    function createTrailParticle() {
        const now = performance.now();
        if (now - lastTrailTime < trailInterval) return;
        lastTrailTime = now;

        const trail = document.createElement('div');
        trail.className = 'ball-trail';

        // Slightly smaller than the main ball
        const tSize = ballSize * 0.85;
        trail.style.width = tSize + 'px';
        trail.style.height = tSize + 'px';

        // Center the trail particle behind the ball
        trail.style.left = (ballX + ballSize / 2 - tSize / 2) + 'px';
        trail.style.top = (ballY + ballSize / 2 - tSize / 2) + 'px';

        // Apply intense neon glow
        trail.style.boxShadow = '0 0 15px 5px #ff00ff, 0 0 25px 8px #00ffff, 0 0 40px 15px #a465fe';

        document.body.appendChild(trail);

        // Remove element after animation completes (0.6s match CSS)
        setTimeout(() => {
            if (trail.parentNode) {
                trail.parentNode.removeChild(trail);
            }
        }, 600);

        // Randomly spawn sparkles
        if (Math.random() > 0.4) {
            createSparkle();
            if (Math.random() > 0.7) createSparkle();
        }
    }

    function createSparkle() {
        const sparkle = document.createElement('div');
        sparkle.className = 'ball-sparkle';
        
        // Random size
        const sSize = Math.random() * 4 + 2;
        sparkle.style.width = sSize + 'px';
        sparkle.style.height = sSize + 'px';

        // Randomly scatter from the ball's center
        const startX = ballX + ballSize / 2 + (Math.random() * 20 - 10);
        const startY = ballY + ballSize / 2 + (Math.random() * 20 - 10);
        sparkle.style.left = (startX - sSize / 2) + 'px';
        sparkle.style.top = (startY - sSize / 2) + 'px';

        // Random neon color
        const colors = ['#00ffff', '#ff00ff', '#ffffff'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        sparkle.style.boxShadow = `0 0 ${sSize * 2}px ${sSize}px ${color}, 0 0 ${sSize * 4}px ${sSize * 2}px ${color}`;

        // Direction of scatter (drifting/sparks)
        const throwX = -ballVx * 0.5 + (Math.random() * 80 - 40);
        const throwY = -ballVy * 0.5 + (Math.random() * 80 - 40);
        sparkle.style.setProperty('--sparkle-translate', `translate(${throwX}px, ${throwY}px)`);

        document.body.appendChild(sparkle);

        // Remove after 0.8s
        setTimeout(() => {
            if (sparkle.parentNode) {
                sparkle.parentNode.removeChild(sparkle);
            }
        }, 800);
    }

    function pickTarget() {
        // Find visible targets that haven't been destroyed yet (max 3 hits)
        const allCollidables = Array.from(document.querySelectorAll(collidableSelectors.join(', ')))
            .filter(el => {
                const hits = parseInt(el.dataset.hits || '0', 10);
                return hits < 3 && el.offsetParent !== null;
            });

        // If absolutely no targets are left on the screen at all, stop the bouncing ball but heavily retain the damage!
        if (allCollidables.length === 0) {
            stopBouncingBall(true);
            return;
        }

        // Filter out the element we JUST hit, unless it is literally the only element left on the page
        let validTargets = allCollidables.filter(el => el !== lastHitElement);

        if (validTargets.length === 0) {
            // We have to target the last hit element because nothing else is left
            validTargets = allCollidables;
        }

        currentTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
    }

    function updateBall() {
        if (!ballActive) return;

        // Speed ramp up (smooth time dilation recovery)
        if (timeScale < 1.0) {
            timeScale += 0.008; // Smoother and longer wind-up
            if (timeScale > 1.0) timeScale = 1.0;
        }

        if (currentTarget) {
            // Check if current target is still valid
            if (currentTarget.classList.contains('damaged') || currentTarget.offsetParent === null) {
                pickTarget();
            }
        }

        if (currentTarget) {
            // Active Homing Missile logic
            const rect = currentTarget.getBoundingClientRect();
            const tx = rect.left + rect.width / 2;
            const ty = rect.top + rect.height / 2;

            const dx = tx - (ballX + ballSize / 2);
            const dy = ty - (ballY + ballSize / 2);
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            // Preferred constant speed towards target
            const targetSpeed = 12;
            const targetVx = (dx / dist) * targetSpeed;
            const targetVy = (dy / dist) * targetSpeed;

            // Steer velocity towards the target velocity (applying turnRate)
            ballVx += (targetVx - ballVx) * turnRate * timeScale;
            ballVy += (targetVy - ballVy) * turnRate * timeScale;
        } else {
            // No targets left, just fall with floaty gravity
            ballVy += gravity * timeScale;
        }

        // Cap speeds
        if (ballVx > maxSpeed) ballVx = maxSpeed;
        if (ballVx < -maxSpeed) ballVx = -maxSpeed;
        if (ballVy > maxSpeed) ballVy = maxSpeed;
        if (ballVy < -maxSpeed) ballVy = -maxSpeed;

        ballX += ballVx * timeScale;
        ballY += ballVy * timeScale;

        const maxW = window.innerWidth - ballSize;
        const maxH = window.innerHeight - ballSize;
        let bounced = false;

        // Wall & Floor limits
        if (ballX <= 0) {
            ballX = 0;
            bounced = true;
        } else if (ballX >= maxW) {
            ballX = maxW;
            bounced = true;
        }

        if (ballY <= 0) {
            ballY = 0;
            bounced = true;
        } else if (ballY >= maxH) {
            ballY = maxH;
            bounced = true;
        }

        if (bounced) {
            timeScale = 0.85; // Much softer reduction on generic walls/floors
            lastHitElement = null; // Forget what we just hit since we bounced off a wall
            // Don't auto-pick new target on boundary bounce anymore since we continuously seek
        }

        ballEl.style.left = ballX + 'px';
        ballEl.style.top = ballY + 'px';

        createTrailParticle();
        checkCollisions();

        if (ballActive) {
            animationId = requestAnimationFrame(updateBall);
        }
    }

    function checkCollisions() {
        const ballRect = ballEl.getBoundingClientRect();
        const collidables = document.querySelectorAll(collidableSelectors.join(', '));

        for (const el of collidables) {
            const hits = parseInt(el.dataset.hits || '0', 10);
            if (hits >= 3) continue; // Fully destroyed
            if (el.offsetParent === null) continue; // Invisible

            const rect = el.getBoundingClientRect();

            if (ballRect.left < rect.right &&
                ballRect.right > rect.left &&
                ballRect.top < rect.bottom &&
                ballRect.bottom > rect.top) {

                // Element Hit!
                const newHits = hits + 1;
                el.dataset.hits = newHits;

                // Remove all previous damaged classes
                el.classList.remove('damaged-1', 'damaged-2', 'damaged-3');
                // Apply the new appropriate damaged class
                el.classList.add(`damaged-${newHits}`);

                lastHitElement = el; // Record the hit!

                // Slow down dramatically for the dramatic buildup effect
                timeScale = 0.6; // Less slow down on target hit than before (was 0.4)

                // Softly nudge out of the bounds of the hit object to prevent getting stuck
                const overlapLeft = ballRect.right - rect.left;
                const overlapRight = rect.right - ballRect.left;
                const overlapTop = ballRect.bottom - rect.top;
                const overlapBottom = rect.bottom - ballRect.top;

                const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

                if (minOverlap === overlapLeft) ballX -= minOverlap;
                else if (minOverlap === overlapRight) ballX += minOverlap;
                else if (minOverlap === overlapTop) ballY -= minOverlap;
                else if (minOverlap === overlapBottom) ballY += minOverlap;

                // Add a small bounce impulse away from the collided object so it doesn't just drill into it
                if (minOverlap === overlapLeft) ballVx = -8;
                else if (minOverlap === overlapRight) ballVx = 8;
                else if (minOverlap === overlapTop) ballVy = -8;
                else if (minOverlap === overlapBottom) ballVy = 8;

                // Pick a brand new target
                pickTarget();

                break;
            }
        }
    }
});
