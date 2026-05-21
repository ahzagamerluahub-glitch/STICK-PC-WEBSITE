// script.js
document.addEventListener('DOMContentLoaded', () => {
    // --- Konfigurasi ---
    const CONFIG = {
        bootDuration: 2500,
    };

    // --- State Aplikasi ---
    let state = {
        activeIndex: 0,
        menuItems: [], // DOM elements
        contentPanels: [], // DOM elements
        isBooting: true,
        gamepadIndex: null,
        inputCooldown: false, // Untuk debounce input controller
    };

    // --- Sistem Audio (Synthesizer untuk Efek UI) ---
    // Kita menggunakan Web Audio APIagar tidak perlu file mp3 externo
    const AudioSys = {
        ctx: new (window.AudioContext || window.webkitAudioContext)(),
        
        // Nada saat hover menu
        playHover: () => {
            if(AudioSys.ctx.state === 'suspended') AudioSys.ctx.resume();
            const osc = AudioSys.ctx.createOscillator();
            const gain = AudioSys.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, AudioSys.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, AudioSys.ctx.currentTime + 0.05);
            gain.gain.setValueAtTime(0.1, AudioSys.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, AudioSys.ctx.currentTime + 0.05);
            osc.connect(gain);
            gain.connect(AudioSys.ctx.destination);
            osc.start();
            osc.stop(AudioSys.ctx.currentTime + 0.05);
        },

        // Nada saat pilih menu
        playSelect: () => {
            if(AudioSys.ctx.state === 'suspended') AudioSys.ctx.resume();
            const osc = AudioSys.ctx.createOscillator();
            const gain = AudioSys.ctx.createGain();
            osc.type = 'square'; // Suara sedikit "game"
            osc.frequency.setValueAtTime(400, AudioSys.ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(1200, AudioSys.ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, AudioSys.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, AudioSys.ctx.currentTime + 0.1);
            osc.connect(gain);
            gain.connect(AudioSys.ctx.destination);
            osc.start();
            osc.stop(AudioSys.ctx.currentTime + 0.1);
        },

        // Sound Boot
        playBootSound: () => {
            if(AudioSys.ctx.state === 'suspended') AudioSys.ctx.resume();
            const osc = AudioSys.ctx.createOscillator();
            const gain = AudioSys.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, AudioSys.ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(880, AudioSys.ctx.currentTime + 0.5);
            gain.gain.setValueAtTime(0.1, AudioSys.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, AudioSys.ctx.currentTime + 1.0);
            osc.connect(gain);
            gain.connect(AudioSys.ctx.destination);
            osc.start();
            osc.stop(AudioSys.ctx.currentTime + 1.0);
        }
    };

    // --- Inisialisasi Elemen DOM ---
    const bootScreen = document.getElementById('boot-screen');
    const uiContainer = document.getElementById('ui-container');
    const menuList = document.getElementById('menu-list');
    const menuItems = menuList.querySelectorAll('li');
    
    // Mapping panel ID
    const mappings = {
        'panel-home': 'panel-home',
        'panel-games': 'panel-games',
        'panel-emulator': 'panel-emulator',
        'panel-cloud': 'panel-cloud',
        'panel-gallery': 'panel-gallery',
        'panel-settings': 'panel-settings'
    };
    
    // Ambil semua panel yang ada di HTML
    const allPanels = document.querySelectorAll('.content-panel');
    state.contentPanels = Array.from(allPanels);
    state.menuItems = Array.from(menuItems);

    // --- Boot Sequence ---
    function runBootSequence() {
        AudioSys.playBootSound();
        
        setTimeout(() => {
            bootScreen.style.opacity = '0';
            setTimeout(() => {
                bootScreen.style.display = 'none';
                uiContainer.classList.remove('hidden');
                state.isBooting = false;
                updateUI(); // Tampilkan menu awal
                startGameLoop(); // Mulai loop game
            }, 1000);
        }, CONFIG.bootDuration);
    }

    // --- Logika Navigasi XMB ---
    function setActivePanel(index) {
        // Loop menu
        if (index < 0) index = state.menuItems.length - 1;
        if (index >= state.menuItems.length) index = 0;
        
        state.activeIndex = index;
        AudioSys.playHover();
        updateUI();
    }

    function updateUI() {
        // Reset kelas active
        state.menuItems.forEach((el, i) => {
            if(i === state.activeIndex) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });

        // Tampilkan panel yang sesuai
        const targetId = state.menuItems[state.activeIndex].getAttribute('data-target');
        state.contentPanels.forEach(panel => {
            if (panel.id === targetId) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });
    }

    // --- Input Handling (Keyboard & Touch) ---
    document.addEventListener('keydown', (e) => {
        if (state.isBooting) return;

        if (e.key === 'ArrowRight' || e.key === 'd') {
            setActivePanel(state.activeIndex + 1);
        } else if (e.key === 'ArrowLeft' || e.key === 'a') {
            setActivePanel(state.activeIndex - 1);
        } else if (e.key === 'Enter' || e.key === ' ') {
            AudioSys.playSelect();
        }
    });

    // Click / Touch pada menu
    state.menuItems.forEach((el, i) => {
        el.addEventListener('click', () => {
            setActivePanel(i);
        });
    });

    // --- Gamepad API (Controller Support) ---
    window.addEventListener("gamepadconnected", (e) => {
        console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
        e.gamepad.index, e.gamepad.id,
        e.gamepad.buttons.length, e.gamepad.axes.length);
        state.gamepadIndex = e.gamepad.index;
        document.getElementById('controller-status').innerText = "🎮 Connected";
    });

    window.addEventListener("gamepaddisconnected", (e) => {
        console.log("Gamepad disconnected from index %d: %s",
        e.gamepad.index, e.gamepad.id);
        state.gamepadIndex = null;
        document.getElementById('controller-status').innerText = "🎮 Connect";
    });

    function pollGamepad() {
        if (state.gamepadIndex === null) return;

        const gp = navigator.getGamepads()[state.gamepadIndex];
        if (!gp) return;

        const threshold = 0.5;

        // D-Pad (Buttons 14 & 15) or Left Analog (Axis 0)
        const btnLeft = gp.buttons[14];
        const btnRight = gp.buttons[15];
        const axisX = gp.axes[0];

        // Cek Input Kiri
        if ((axisX < -threshold || btnLeft.pressed) && !state.inputCooldown) {
            setActivePanel(state.activeIndex - 1);
            state.inputCooldown = true;
            setTimeout(() => state.inputCooldown = false, 200);
        }
        // Cek Input Kanan
        else if ((axisX > threshold || btnRight.pressed) && !state.inputCooldown) {
            setActivePanel(state.activeIndex + 1);
            state.inputCooldown = true;
            setTimeout(() => state.inputCooldown = false, 200);
        }

        // Tombol A/Cross (Button 0) untuk Select
        if (gp.buttons[0].pressed && !state.inputCooldown) {
            AudioSys.playSelect();
            state.inputCooldown = true;
            setTimeout(() => state.inputCooldown = false, 300);
        }
    }

    // --- Game Loop (Update Clock & Input) ---
    function startGameLoop() {
        function loop() {
            if (!state.isBooting) {
                // Update Jam realtime
                const now = new Date();
                const timeString = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                document.getElementById('clock').innerText = timeString;

                // Polling Gamepad
                pollGamepad();
            }
            requestAnimationFrame(loop);
        }
        loop();
    }

    // --- Fitur Fullscreen ---
    const fsBtn = document.getElementById('fs-btn');
    fsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                alert(`Error enabling fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    });

    // Jalankan Boot
    runBootSequence();
});
