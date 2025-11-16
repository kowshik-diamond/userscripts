// ==UserScript==
// @name         Video Player Controls + Gestures (No Volume) - Centered Controls
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Add forward/backward 10sec, seek bar, fullscreen overlay, YouTube-style gestures for HTML5 videos; volume features removed; center playback buttons under seek bar; tap toggles controls.
// @author       You
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function formatTime(seconds) {
        if (!isFinite(seconds) || seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function addControls(video) {
        if (video.dataset.customControlsAdded) return;
        video.dataset.customControlsAdded = 'true';

        // --- Floating button ---
        const floatingBtn = document.createElement('div');
        floatingBtn.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: rgba(15,191,239,0.85);
            padding: 8px;
            border-radius: 50%;
            z-index: 999998;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.45);
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            transition: opacity 0.25s, transform 0.2s;
        `;
        floatingBtn.innerHTML = '⛶';
        floatingBtn.title = 'Open Video Controls';

        // Auto-hide floating button on scroll (throttle)
        let lastScroll = 0;
        let floatingHidden = false;
        const hideFloating = () => {
            if (!floatingHidden) {
                floatingBtn.style.opacity = '0';
                floatingBtn.style.transform = 'translateY(8px)';
                floatingHidden = true;
            }
        };
        const showFloating = () => {
            if (floatingHidden) {
                floatingBtn.style.opacity = '1';
                floatingBtn.style.transform = 'translateY(0)';
                floatingHidden = false;
            }
        };
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            const now = Date.now();
            if (now - lastScroll > 120) {
                hideFloating();
                lastScroll = now;
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    showFloating();
                }, 800);
            }
        }, { passive: true });

        // --- Overlay container ---
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.95);
            z-index: 999999;
            display: none;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        `;

        const videoWrapper = document.createElement('div');
        videoWrapper.style.cssText = `
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: black;
            position: relative;
            overflow: hidden;
            touch-action: none; /* manage gestures manually */
        `;

        // store original parent to restore later
        let originalParent = null;
        let originalNextSibling = null;

        const moveVideoToOverlay = () => {
            if (!originalParent) {
                originalParent = video.parentElement;
                originalNextSibling = video.nextSibling;
            }
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.maxWidth = '100%';
            video.style.maxHeight = '100%';
            video.style.objectFit = 'contain';
            videoWrapper.appendChild(video);
        };

        const restoreVideo = () => {
            if (originalParent) {
                video.style.width = '';
                video.style.height = '';
                video.style.maxWidth = '';
                video.style.maxHeight = '';
                video.style.objectFit = '';
                if (originalNextSibling) originalParent.insertBefore(video, originalNextSibling);
                else originalParent.appendChild(video);
            }
        };

        // --- Controls UI ---
        const controlsOverlay = document.createElement('div');
        controlsOverlay.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0; right: 0;
            background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 70%, transparent 100%);
            padding: 30px 20px 40px;
            transition: opacity 0.25s, visibility 0.25s;
            opacity: 0; visibility: hidden;
        `;

        let hideControlsTimeout;
        const showControls = () => {
            controlsOverlay.style.opacity = '1';
            controlsOverlay.style.visibility = 'visible';
            closeBtn.style.opacity = '1';
            closeBtn.style.visibility = 'visible';
            clearTimeout(hideControlsTimeout);
            hideControlsTimeout = setTimeout(() => {
                controlsOverlay.style.opacity = '0';
                controlsOverlay.style.visibility = 'hidden';
                closeBtn.style.opacity = '0';
                closeBtn.style.visibility = 'hidden';
            }, 3000);
        };
        const hideControlsNow = () => {
            clearTimeout(hideControlsTimeout);
            controlsOverlay.style.opacity = '0';
            controlsOverlay.style.visibility = 'hidden';
            closeBtn.style.opacity = '0';
            closeBtn.style.visibility = 'hidden';
        };
        const toggleControls = () => {
            if (controlsOverlay.style.opacity === '0' || controlsOverlay.style.visibility === 'hidden') showControls();
            else hideControlsNow();
        };

        // Tapping anywhere on overlay toggles controls (mobile-friendly)
        container.addEventListener('click', (e) => {
            // Allow clicks on control elements to stop propagation (buttons will call e.stopPropagation())
            if (e.target === container || e.target === videoWrapper || e.target === video) {
                toggleControls();
            }
        });

        // --- Seek row (top) ---
        const seekContainer = document.createElement('div');
        seekContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 20px;
            width: calc(100% - 40px);
            max-width: 1200px;
        `;

        const currentTimeDisplay = document.createElement('span');
        currentTimeDisplay.style.cssText = `color:white;font-size:14px;min-width:55px;font-family:-apple-system,system-ui,sans-serif;`;
        currentTimeDisplay.textContent = '0:00';

        const seekBar = document.createElement('input');
        seekBar.type = 'range';
        seekBar.min = '0';
        seekBar.max = '100';
        seekBar.value = '0';
        seekBar.style.cssText = `
            flex:1;height:4px;cursor:pointer;-webkit-appearance:none;background:rgba(255,255,255,0.28);border-radius:2px;outline:none;
        `;

        // seek thumb style
        const style = document.createElement('style');
        style.textContent = `
            input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 14px; height:14px; border-radius:50%; background:white; cursor:pointer;
            }
            input[type="range"]::-moz-range-thumb {
                width: 14px; height:14px; border-radius:50%; background:white; cursor:pointer; border:none;
            }
        `;
        document.head.appendChild(style);

        const durationDisplay = document.createElement('span');
        durationDisplay.style.cssText = `color:white;font-size:14px;min-width:55px;text-align:right;font-family:-apple-system,system-ui,sans-serif;`;
        durationDisplay.textContent = '0:00';

        seekContainer.appendChild(currentTimeDisplay);
        seekContainer.appendChild(seekBar);
        seekContainer.appendChild(durationDisplay);

        // --- Bottom row: centered playback controls + right side speed/fullscreen ---
        const playbackControls = document.createElement('div');
        playbackControls.style.cssText = `
            display:flex;justify-content:space-between;align-items:center;padding:0 15px;margin-top:10px;width:calc(100% - 40px);max-width:1200px;
        `;

        // Centered small playback group (Option A: horizontal center)
        const centerControls = document.createElement('div');
        centerControls.style.cssText = `
            display:flex;align-items:center;gap:12px;justify-content:center;
        `;

        const buttonCommonStyle = `
            background:transparent;border:none;color:white;cursor:pointer;padding:6px;opacity:0.95;
        `;

        const backwardBtn = document.createElement('button');
        backwardBtn.innerHTML = '⏮';
        backwardBtn.style.cssText = `${buttonCommonStyle}font-size:22px;`;
        backwardBtn.onclick = (e) => { e.stopPropagation(); showControls(); video.currentTime = Math.max(0, video.currentTime - 10); };
        backwardBtn.addEventListener('click', (e) => e.stopPropagation());

        const playPauseBtn = document.createElement('button');
        playPauseBtn.innerHTML = '⏸';
        playPauseBtn.style.cssText = `${buttonCommonStyle}font-size:26px;`;
        playPauseBtn.onclick = (e) => { e.stopPropagation(); showControls(); if (video.paused) video.play(); else video.pause(); updatePlayPauseIcon(); };
        playPauseBtn.addEventListener('click', (e) => e.stopPropagation());

        const forwardBtn = document.createElement('button');
        forwardBtn.innerHTML = '⏭';
        forwardBtn.style.cssText = `${buttonCommonStyle}font-size:22px;`;
        forwardBtn.onclick = (e) => { e.stopPropagation(); showControls(); video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10); };
        forwardBtn.addEventListener('click', (e) => e.stopPropagation());

        centerControls.appendChild(backwardBtn);
        centerControls.appendChild(playPauseBtn);
        centerControls.appendChild(forwardBtn);

        // Right controls: speed + fullscreen
        const speedBtn = document.createElement('button');
        speedBtn.innerHTML = '1x';
        speedBtn.style.cssText = `background:rgba(255,255,255,0.14);border:none;color:white;font-size:16px;padding:8px 12px;border-radius:6px;font-weight:600;cursor:pointer;`;
        const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
        let currentSpeedIndex = 3;
        speedBtn.onclick = (e) => { e.stopPropagation(); showControls(); currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length; video.playbackRate = speeds[currentSpeedIndex]; speedBtn.innerHTML = speeds[currentSpeedIndex] + 'x'; };

        const fullscreenIconBtn = document.createElement('button');
        fullscreenIconBtn.innerHTML = '⛶';
        fullscreenIconBtn.style.cssText = `background:transparent;border:none;color:white;font-size:20px;cursor:pointer;padding:6px;`;
        fullscreenIconBtn.onclick = (e) => { e.stopPropagation(); showControls(); if (document.fullscreenElement) document.exitFullscreen(); else container.requestFullscreen().catch(()=>{}); };

        const rightControls = document.createElement('div');
        rightControls.style.cssText = `display:flex;align-items:center;gap:12px;`;
        rightControls.appendChild(speedBtn);
        rightControls.appendChild(fullscreenIconBtn);

        // Arrange playbackControls: left spacer (empty) | centerControls (centered) | rightControls
        const leftSpacer = document.createElement('div');
        leftSpacer.style.cssText = `width: 1px;`; // small spacer to allow center alignment
        playbackControls.appendChild(leftSpacer);
        playbackControls.appendChild(centerControls);
        playbackControls.appendChild(rightControls);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
            position:absolute;top:20px;left:20px;background:rgba(0,0,0,0.5);color:white;border:none;font-size:28px;cursor:pointer;padding:10px;border-radius:50%;width:46px;height:46px;display:flex;align-items:center;justify-content:center;transition:opacity 0.25s;
        `;
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            container.style.display = 'none';
            floatingBtn.style.display = 'flex';
            restoreVideo();
        };

        // Append assembled control overlays
        controlsOverlay.appendChild(seekContainer);
        controlsOverlay.appendChild(playbackControls);

        container.appendChild(closeBtn);
        container.appendChild(videoWrapper);
        container.appendChild(controlsOverlay);

        // Add to DOM
        document.body.appendChild(floatingBtn);
        document.body.appendChild(container);

        // --- Seek and time updates ---
        video.addEventListener('loadedmetadata', () => {
            seekBar.max = video.duration || 0;
            durationDisplay.textContent = formatTime(video.duration || 0);
        });
        video.addEventListener('timeupdate', () => {
            if (!seekBar.matches(':active')) seekBar.value = video.currentTime;
            currentTimeDisplay.textContent = formatTime(video.currentTime || 0);
        });

        seekBar.addEventListener('input', (e) => { e.stopPropagation(); video.currentTime = parseFloat(seekBar.value); });
        seekBar.addEventListener('change', (e) => { e.stopPropagation(); video.currentTime = parseFloat(seekBar.value); });

        const updatePlayPauseIcon = () => { playPauseBtn.innerHTML = video.paused ? '▶' : '⏸'; };
        video.addEventListener('play', updatePlayPauseIcon);
        video.addEventListener('pause', updatePlayPauseIcon);
        updatePlayPauseIcon();

        // --- Gesture system (Option A: YouTube-style but without vertical volume) ---
        // State variables
        let lastTap = 0;
        let tapCount = 0;
        const DOUBLE_TAP_MAX_DELAY = 300; // ms
        const LONG_PRESS_DELAY = 500; // ms
        let longPressTimer = null;

        // For swipe/drag
        let touchActive = false;
        let startX = 0, startY = 0;
        let isHorizontal = false, isVertical = false;
        let accumulatedSeekPreview = 0; // seconds preview while dragging
        let previewActive = false;

        // preview overlay shown during hold or swipe
        const previewOverlay = document.createElement('div');
        previewOverlay.style.cssText = `
            position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
            background:rgba(0,0,0,0.6);color:white;padding:10px 14px;border-radius:8px;font-size:16px;display:none;z-index:30;
            pointer-events:none;
        `;
        previewOverlay.textContent = '0:00';
        videoWrapper.appendChild(previewOverlay);

        // Helper: show preview with a time
        const showPreview = (timeSec) => {
            previewOverlay.textContent = formatTime(Math.max(0, Math.min(video.duration || 0, timeSec)));
            previewOverlay.style.display = 'block';
            previewActive = true;
        };
        const hidePreview = () => { previewOverlay.style.display = 'none'; previewActive = false; accumulatedSeekPreview = 0; };

        // Convert horizontal delta to seconds (full width => 30% of duration or 60s min)
        const deltaXToSeconds = (dx) => {
            const w = videoWrapper.clientWidth || window.innerWidth;
            const dur = video.duration || 60;
            const scale = Math.max(60, dur * 0.3);
            return (dx / w) * scale;
        };

        // Touch handlers
        videoWrapper.addEventListener('touchstart', (ev) => {
            if (!ev.touches || ev.touches.length > 1) return;
            const t = ev.touches[0];
            touchActive = true;
            startX = t.clientX;
            startY = t.clientY;
            isHorizontal = isVertical = false;
            accumulatedSeekPreview = 0;

            // Long press detection (show preview)
            clearTimeout(longPressTimer);
            longPressTimer = setTimeout(() => {
                showPreview(video.currentTime || 0);
            }, LONG_PRESS_DELAY);

            // Double-tap detection
            const now = Date.now();
            if (now - lastTap <= DOUBLE_TAP_MAX_DELAY) tapCount += 1;
            else tapCount = 1;
            lastTap = now;
        }, { passive: false });

        videoWrapper.addEventListener('touchmove', (ev) => {
            if (!touchActive) return;
            const t = ev.touches[0];
            const dx = t.clientX - startX;
            const dy = t.clientY - startY;
            const absX = Math.abs(dx), absY = Math.abs(dy);

            // determine gesture orientation if not decided
            if (!isHorizontal && !isVertical) {
                if (absX > 10 || absY > 10) {
                    if (absX > absY) isHorizontal = true;
                    else isVertical = true;
                }
            }

            // Only handle horizontal swipes (vertical gestures are ignored to allow page scroll)
            if (isHorizontal) {
                ev.preventDefault(); // prevent page horizontal swipe
                const sec = deltaXToSeconds(dx);
                accumulatedSeekPreview = sec;
                showPreview((video.currentTime || 0) + accumulatedSeekPreview);
            }
        }, { passive: false });

        videoWrapper.addEventListener('touchend', (ev) => {
            clearTimeout(longPressTimer);
            if (!touchActive) return;
            touchActive = false;

            // If we showed preview due to swipe, commit the seek
            if (previewActive && Math.abs(accumulatedSeekPreview) > 0.5) {
                const target = Math.max(0, Math.min(video.duration || 0, (video.currentTime || 0) + accumulatedSeekPreview));
                video.currentTime = target;
                hidePreview();
            } else {
                // handle double-tap vs single tap
                const now = Date.now();
                if (tapCount >= 2 && (now - lastTap) <= DOUBLE_TAP_MAX_DELAY + 30) {
                    let touchX = 0;
                    if (ev.changedTouches && ev.changedTouches.length) touchX = ev.changedTouches[0].clientX;
                    else touchX = startX;
                    const half = (videoWrapper.clientWidth || window.innerWidth) / 2;
                    if (touchX < half) {
                        video.currentTime = Math.max(0, (video.currentTime || 0) - 10);
                        previewOverlay.textContent = '⟲ 10s';
                        previewOverlay.style.display = 'block';
                        setTimeout(hidePreview, 600);
                    } else {
                        video.currentTime = Math.min(video.duration || Infinity, (video.currentTime || 0) + 10);
                        previewOverlay.textContent = '⟳ 10s';
                        previewOverlay.style.display = 'block';
                        setTimeout(hidePreview, 600);
                    }
                    tapCount = 0;
                } else {
                    // single tap toggles controls (show/hide)
                    toggleControls();
                    setTimeout(() => { tapCount = 0; }, DOUBLE_TAP_MAX_DELAY + 20);
                }
            }

            isHorizontal = isVertical = false;
            accumulatedSeekPreview = 0;
        }, { passive: false });

        // Desktop equivalents (mouse): drag to seek preview, dblclick skip
        let mouseDown = false, mouseStartX = 0, mouseAccSeek = 0;
        videoWrapper.addEventListener('mousedown', (e) => {
            // left click only
            if (e.button !== 0) return;
            mouseDown = true;
            mouseStartX = e.clientX;
            mouseAccSeek = 0;
            e.preventDefault();
            longPressTimer = setTimeout(() => { showPreview(video.currentTime || 0); }, LONG_PRESS_DELAY);
        });
        window.addEventListener('mousemove', (e) => {
            if (!mouseDown) return;
            const dx = e.clientX - mouseStartX;
            mouseAccSeek = deltaXToSeconds(dx);
            showPreview((video.currentTime || 0) + mouseAccSeek);
        });
        window.addEventListener('mouseup', (e) => {
            clearTimeout(longPressTimer);
            if (!mouseDown) return;
            mouseDown = false;
            if (previewActive && Math.abs(mouseAccSeek) > 0.5) {
                video.currentTime = Math.max(0, Math.min(video.duration || 0, (video.currentTime || 0) + mouseAccSeek));
                hidePreview();
            } else {
                hidePreview();
            }
        });

        // Double-click desktop: skip 10s left/right
        videoWrapper.addEventListener('dblclick', (e) => {
            const rect = videoWrapper.getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x < rect.width / 2) {
                video.currentTime = Math.max(0, (video.currentTime || 0) - 10);
                previewOverlay.textContent = '⟲ 10s';
            } else {
                video.currentTime = Math.min(video.duration || Infinity, (video.currentTime || 0) + 10);
                previewOverlay.textContent = '⟳ 10s';
            }
            previewOverlay.style.display = 'block';
            setTimeout(hidePreview, 600);
        });

        // --- Floating button click ---
        floatingBtn.onclick = () => {
            container.style.display = 'flex';
            floatingBtn.style.display = 'none';
            moveVideoToOverlay();
            showControls();
        };

        // Remove controls when video removed from DOM
        const observer = new MutationObserver(() => {
            if (!document.body.contains(video)) {
                container.remove();
                floatingBtn.remove();
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Keep floating visibility synced when tab visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) floatingBtn.style.opacity = '0';
            else floatingBtn.style.opacity = '1';
        });

        // Keyboard shortcuts when overlay open (volume keys removed)
        document.addEventListener('keydown', (e) => {
            if (container.style.display !== 'flex') return;
            if (e.key === 'ArrowRight') { video.currentTime = Math.min((video.duration || Infinity), (video.currentTime || 0) + 5); showControls(); }
            if (e.key === 'ArrowLeft') { video.currentTime = Math.max(0, (video.currentTime || 0) - 5); showControls(); }
            if (e.key === ' ') { e.preventDefault(); if (video.paused) video.play(); else video.pause(); updatePlayPauseIcon(); showControls(); }
            if (e.key === 'f') { if (document.fullscreenElement) document.exitFullscreen(); else container.requestFullscreen().catch(()=>{}); }
            if (e.key === 'Escape') { closeBtn.click(); }
        });

        // Ensure seekBar updates on metadata load
        video.addEventListener('loadedmetadata', () => { seekBar.max = video.duration || 0; durationDisplay.textContent = formatTime(video.duration || 0); });
    }

    function findVideos() {
        document.querySelectorAll('video').forEach(addControls);
    }

    // Initial scan + observe DOM changes
    findVideos();
    const observer = new MutationObserver(findVideos);
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(findVideos, 2000);

})();
