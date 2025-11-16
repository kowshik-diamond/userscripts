// ==UserScript==
// @name         Video Player Controls + Gestures (No Volume) - Centered Controls UPDATED
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  YouTube-style gestures + seek bar + fullscreen overlay; double-tap left/right/center; play/pause button in left corner; no volume controls; forward/backward buttons removed.
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

        /* =============================
           FLOATING BUTTON
        ============================== */
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
        document.body.appendChild(floatingBtn);

        /* Auto hide floating button */
        let lastScroll = 0;
        let floatingHidden = false;
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            const now = Date.now();
            if (now - lastScroll > 120) {
                if (!floatingHidden) {
                    floatingBtn.style.opacity = "0";
                    floatingBtn.style.transform = "translateY(10px)";
                    floatingHidden = true;
                }
                lastScroll = now;
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    floatingBtn.style.opacity = "1";
                    floatingBtn.style.transform = "translateY(0)";
                    floatingHidden = false;
                }, 700);
            }
        });

        /* =============================
           OVERLAY CONTAINER
        ============================== */
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            inset: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.95);
            z-index: 999999;
            display: none;
            align-items: center;
            justify-content: center;
        `;

        const videoWrapper = document.createElement('div');
        videoWrapper.style.cssText = `
            position: relative;
            width: 100%; height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: black;
            overflow: hidden;
            touch-action: none;
        `;

        container.appendChild(videoWrapper);
        document.body.appendChild(container);

        /* Save original */
        let originalParent = null;
        let originalNextSibling = null;

        function moveVideoToOverlay() {
            if (!originalParent) {
                originalParent = video.parentElement;
                originalNextSibling = video.nextSibling;
            }
            video.style.width = "100%";
            video.style.height = "100%";
            video.style.objectFit = "contain";
            videoWrapper.appendChild(video);
        }

        function restoreVideo() {
            video.style.width = "";
            video.style.height = "";
            video.style.objectFit = "";
            if (originalParent) {
                if (originalNextSibling) originalParent.insertBefore(video, originalNextSibling);
                else originalParent.appendChild(video);
            }
        }

        /* =============================
           CONTROLS OVERLAY (BOTTOM AREA)
        ============================== */
        const controlsOverlay = document.createElement('div');
        controlsOverlay.style.cssText = `
            position: absolute;
            bottom: 0; left: 0; right: 0;
            background: linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.6), transparent);
            padding: 30px 20px 40px;
            opacity: 0; visibility: hidden;
            transition: opacity .25s, visibility .25s;
        `;
        videoWrapper.appendChild(controlsOverlay);

        let hideControlsTimeout;

        function showControls() {
            controlsOverlay.style.opacity = "1";
            controlsOverlay.style.visibility = "visible";
            closeBtn.style.opacity = "1";
            closeBtn.style.visibility = "visible";

            clearTimeout(hideControlsTimeout);
            hideControlsTimeout = setTimeout(() => hideControlsNow(), 3000);
        }

        function hideControlsNow() {
            controlsOverlay.style.opacity = "0";
            controlsOverlay.style.visibility = "hidden";
            closeBtn.style.opacity = "0";
            closeBtn.style.visibility = "hidden";
        }

        function toggleControls() {
            if (controlsOverlay.style.visibility === "hidden") showControls();
            else hideControlsNow();
        }

        container.addEventListener('click', (e) => {
            if (e.target === container || e.target === videoWrapper) toggleControls();
        });

        /* =============================
           SEEK BAR ROW
        ============================== */
        const seekRow = document.createElement('div');
        seekRow.style.cssText = `
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 20px;
            width: calc(100% - 40px);
            max-width: 1200px;
        `;

        const curTime = document.createElement('span');
        curTime.style.cssText = `color:white;font-size:15px;min-width:55px;`;
        curTime.textContent = "0:00";

        const seekBar = document.createElement('input');
        seekBar.type = "range";
        seekBar.min = "0";
        seekBar.value = "0";
        seekBar.style.cssText = `
            flex: 1;
            height: 4px;
            background: rgba(255,255,255,0.25);
            border-radius: 2px;
            -webkit-appearance:none;
        `;

        /* Thumb style */
        const s = document.createElement('style');
        s.textContent = `
            input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance:none;
                width:16px;height:16px;
                border-radius:50%;
                background:white;
            }
        `;
        document.head.appendChild(s);

        const durTime = document.createElement('span');
        durTime.style.cssText = `color:white;font-size:15px;min-width:55px;text-align:right;`;
        durTime.textContent = "0:00";

        seekRow.appendChild(curTime);
        seekRow.appendChild(seekBar);
        seekRow.appendChild(durTime);

        /* =============================
           BOTTOM CONTROL BAR
        ============================== */

        const bottomControls = document.createElement('div');
        bottomControls.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: calc(100% - 40px);
            max-width: 1200px;
            padding: 0 5px;
        `;

        /* PLAY / PAUSE BUTTON (Left corner!) */
        const playPauseBtn = document.createElement('button');
        playPauseBtn.innerHTML = "⏸";
        playPauseBtn.style.cssText = `
            background: transparent;
            border: none;
            color: white;
            font-size: 26px;
            cursor: pointer;
            padding: 6px 10px;
        `;
        playPauseBtn.onclick = (e) => {
            e.stopPropagation();
            if (video.paused) video.play();
            else video.pause();
            updatePlayIcon();
            showControls();
        };

        /* SEPARATOR (center empty for gestures or future UI) */
        const centerSpacer = document.createElement('div');
        centerSpacer.style.cssText = `flex:1;`;

        /* Right-side buttons: SPEED + FULLSCREEN */
        const speedBtn = document.createElement('button');
        speedBtn.innerHTML = "1x";
        speedBtn.style.cssText = `
            background: rgba(255,255,255,0.14);
            border:none;
            padding:6px 10px;
            border-radius:6px;
            color:white;
            font-weight:600;
            cursor:pointer;
        `;
        const speeds = [0.25,0.5,0.75,1,1.25,1.5,1.75,2];
        let speedIndex = 3;
        speedBtn.onclick = (e) => {
            e.stopPropagation();
            speedIndex = (speedIndex + 1) % speeds.length;
            video.playbackRate = speeds[speedIndex];
            speedBtn.innerHTML = speeds[speedIndex] + "x";
            showControls();
        };

        const fsBtn = document.createElement('button');
        fsBtn.innerHTML = "⛶";
        fsBtn.style.cssText = `
            background:transparent;
            border:none;
            color:white;
            font-size:20px;
            cursor:pointer;
            padding:6px;
        `;
        fsBtn.onclick = (e) => {
            e.stopPropagation();
            if (document.fullscreenElement) document.exitFullscreen();
            else container.requestFullscreen().catch(()=>{});
            showControls();
        };

        const rightSide = document.createElement('div');
        rightSide.style.cssText = `display:flex;align-items:center;gap:12px;`;
        rightSide.appendChild(speedBtn);
        rightSide.appendChild(fsBtn);

        bottomControls.appendChild(playPauseBtn);
        bottomControls.appendChild(centerSpacer);
        bottomControls.appendChild(rightSide);

        /* Add the seek bar + bottom controls into overlay */
        controlsOverlay.appendChild(seekRow);
        controlsOverlay.appendChild(bottomControls);

        /* =============================
           CLOSE BUTTON (top-left)
        ============================== */
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = "✕";
        closeBtn.style.cssText = `
            position:absolute;
            left:20px;top:20px;
            width:46px;height:46px;
            border-radius:50%;
            border:none;
            background:rgba(0,0,0,0.45);
            color:white;
            font-size:26px;
            cursor:pointer;
            z-index:50;
            opacity:0;visibility:hidden;
        `;
        closeBtn.onclick = () => {
            container.style.display = "none";
            floatingBtn.style.display = "flex";
            restoreVideo();
        };
        videoWrapper.appendChild(closeBtn);

        /* =============================
           PLAY/PAUSE BUTTON ICON UPDATE
        ============================== */
        function updatePlayIcon() {
            playPauseBtn.innerHTML = video.paused ? "▶" : "⏸";
        }
        video.addEventListener("play", updatePlayIcon);
        video.addEventListener("pause", updatePlayIcon);

        /* =============================
           SEEK BAR UPDATES
        ============================== */
        video.addEventListener('loadedmetadata', () => {
            seekBar.max = video.duration || 0;
            durTime.textContent = formatTime(video.duration);
        });
        video.addEventListener('timeupdate', () => {
            if (!seekBar.matches(':active')) seekBar.value = video.currentTime;
            curTime.textContent = formatTime(video.currentTime);
        });

        seekBar.addEventListener('input', () => video.currentTime = Number(seekBar.value));

        /* =============================
           YOU-TUBE STYLE DOUBLE TAP LOGIC
           (Left/Center/Right zones)
        ============================== */
        const previewOverlay = document.createElement('div');
        previewOverlay.style.cssText = `
            position:absolute;
            left:50%;top:50%;
            transform:translate(-50%,-50%);
            background:rgba(0,0,0,0.6);
            color:white;
            padding:10px 14px;
            border-radius:8px;
            font-size:18px;
            display:none;
            z-index:90;
            pointer-events:none;
        `;
        videoWrapper.appendChild(previewOverlay);

        function showMessage(msg) {
            previewOverlay.textContent = msg;
            previewOverlay.style.display = "block";
            clearTimeout(previewOverlay._t);
            previewOverlay._t = setTimeout(() => previewOverlay.style.display = "none", 700);
        }

        function getZone(x) {
            const w = videoWrapper.clientWidth;
            if (x < w / 3) return "left";
            if (x > 2 * w / 3) return "right";
            return "center";
        }

        /* DOUBLE TAP STATE */
        let lastTap = 0;
        let tapCount = 0;
        const DOUBLE_TAP_DELAY = 300;

        /* SWIPE PREVIEW */
        let isTouching = false;
        let startX = 0;
        let accumulated = 0;

        function deltaToSeconds(dx) {
            const w = videoWrapper.clientWidth || 400;
            const dur = video.duration || 60;
            const scale = Math.max(50, dur * 0.3);
            return (dx / w) * scale;
        }

        videoWrapper.addEventListener('touchstart', (ev) => {
            if (ev.touches.length > 1) return;
            const t = ev.touches[0];

            isTouching = true;
            startX = t.clientX;
            accumulated = 0;

            const now = Date.now();
            tapCount = now - lastTap < DOUBLE_TAP_DELAY ? tapCount + 1 : 1;
            lastTap = now;
        }, { passive: false });

        videoWrapper.addEventListener('touchmove', (ev) => {
            if (!isTouching) return;
            const t = ev.touches[0];
            const dx = t.clientX - startX;

            accumulated = deltaToSeconds(dx);
            showMessage(formatTime((video.currentTime || 0) + accumulated));
            ev.preventDefault();
        }, { passive: false });

        videoWrapper.addEventListener('touchend', (ev) => {
            if (!isTouching) return;
            isTouching = false;

            if (Math.abs(accumulated) > 0.5) {
                video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + accumulated));
                showMessage(formatTime(video.currentTime));
                accumulated = 0;
                return;
            }

            const now = Date.now();
            const dbl = tapCount >= 2 && now - lastTap < DOUBLE_TAP_DELAY + 50;

            if (dbl) {
                const x = ev.changedTouches[0].clientX;
                const zone = getZone(x);

                if (zone === "left") {
                    video.currentTime = Math.max(0, video.currentTime - 10);
                    showMessage("⟲ 10s");
                }
                else if (zone === "right") {
                    video.currentTime = Math.min(video.duration, video.currentTime + 10);
                    showMessage("⟳ 10s");
                }
                else {
                    if (video.paused) video.play();
                    else video.pause();
                    updatePlayIcon();
                    showMessage(video.paused ? "Paused" : "Playing");
                }

                tapCount = 0;
            }
            else {
                toggleControls();
            }
        });

        /* =============================
           MOUSE DOUBLE CLICK BEHAVIOR
        ============================== */
        videoWrapper.addEventListener('dblclick', (e) => {
            const zone = getZone(e.clientX);

            if (zone === "left") {
                video.currentTime = Math.max(0, video.currentTime - 10);
                showMessage("⟲ 10s");
            }
            else if (zone === "right") {
                video.currentTime = Math.min(video.duration, video.currentTime + 10);
                showMessage("⟳ 10s");
            }
            else {
                if (video.paused) video.play();
                else video.pause();
                updatePlayIcon();
                showMessage(video.paused ? "Paused" : "Playing");
            }
        });

        /* =============================
           FLOATING BUTTON CLICK
        ============================== */
        floatingBtn.onclick = () => {
            container.style.display = "flex";
            floatingBtn.style.display = "none";
            moveVideoToOverlay();
            showControls();
        };

        /* CLEANUP if video removed */
        const observer = new MutationObserver(() => {
            if (!document.body.contains(video)) {
                container.remove();
                floatingBtn.remove();
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function findVideos() {
        document.querySelectorAll("video").forEach(addControls);
    }

    findVideos();
    const observer = new MutationObserver(findVideos);
    observer.observe(document.body, { childList: true, subtree: true });

})();
