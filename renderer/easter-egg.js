window.initEasterEgg = function initEasterEgg() {
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
let globalBounceCount = 0; // Track total bounces for sequential sound

const collidableSelectors = ['.nav-link', '.btn-primary', '.btn-apply', '.setting-control', '.status-item', '.setting-label', '.panel-title', '.toggle-row'];

function playSound(filename, volume = 0.5) {
    const audio = new Audio(`sound/${filename}`);
    audio.volume = volume;
    audio.play().catch(e => console.error("Audio play failed:", e));
}

const bounceSounds = [
    'unicorn_dazzling_orb_bounce_01.mp3',
    'unicorn_dazzling_orb_bounce_02.mp3',
    'unicorn_dazzling_orb_bounce_03.mp3',
    'unicorn_dazzling_orb_bounce_04.mp3',
    'unicorn_dazzling_orb_bounce_05.mp3',
    'unicorn_dazzling_orb_bounce_06.mp3',
    'unicorn_dazzling_orb_bounce_07.mp3',
    'unicorn_dazzling_orb_bounce_08.mp3'
];

function playBounceSound() {
    const soundToPlay = bounceSounds[globalBounceCount % bounceSounds.length];
    globalBounceCount++;
    playSound(soundToPlay, 0.1); // Volume reduced from 0.2 to 0.1
}

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
    globalBounceCount = 0; // Reset bounce sequence

    playSound('unicorn_dazzling_orb_cast_delay.mp3', 0.15); // Volume reduced from 0.3 to 0.15

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
        playBounceSound();
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

            // Check remaining alive elements
            let remainingAlive = 0;
            for (const target of document.querySelectorAll(collidableSelectors.join(', '))) {
                if (target.offsetParent !== null && parseInt(target.dataset.hits || '0', 10) < 3) {
                    remainingAlive++;
                }
            }

            if (remainingAlive === 0) {
                playSound('unicorn_dazzling_orb_final_hit.mp3', 0.18); // Volume reduced from 0.35 to 0.18
            } else {
                playBounceSound();
            }

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

};