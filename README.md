<div align="center">

<img src="./icon.png" width="150" alt="Deadlock Optimized Launcher Icon">

# ⚙️ Deadlock Optimized Launcher

**The Ultimate Automated Resource Manager for Deadlock**

[![Platform](https://img.shields.io/badge/Platform-Windows-0078d7?style=flat-square&logo=windows)](https://github.com/)
[![Built with](https://img.shields.io/badge/Built_with-Electron-47848f?style=flat-square&logo=electron)](https://electronjs.org)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3.0-blue?style=flat-square)](https://www.gnu.org/licenses/agpl-3.0)

*Aggressively optimize your system memory and clear Windows working sets for the smoothest Deadlock experience possible.*

</div>

---

## 🚀 What is the Optimized Launcher?
Deadlock is a highly memory-intensive game. Stutters, frame drops, and input hesitation are often caused by Windows mismanaging standby memory and background working sets while the game is running. 

The **Deadlock Optimized Launcher** is a custom, lightweight standalone executable built from the ground up to guarantee that your system provides maximum resources to the game. By launching Deadlock through this optimizer, it systematically and aggressively clears your system's RAM before the game even starts.

## ✨ Features

- 🧹 **Aggressive RAM Optimization:** Uses official Microsoft Sysinternals tech (**RAMMap**) to safely flush your system's Standby List, Modified Page List, and System Working Sets.
- ⚡ **Intelligent Fast Search:** No setup required. Utilizing a blistering-fast native scanner (`fd.exe`), it automatically finds your `Deadlock.url` or shortcut across your drives.
- ⚙️ **Advanced Launch Options:** Improve single-thread performance by automatically disabling SMT (Simultaneous Multithreading) and forcing High Priority mode when the game boots.
- 📊 **Custom Statistics Tracker:** Keep track of your optimization impact natively! See your total times launched and the lifetime RAM freed in Megabytes/Gigabytes.
- 💻 **Live System Monitoring:** A beautiful, multi-tabbed custom UI that displays your live Available RAM and Total RAM statistics in real-time.
- 🎯 **Zero-Delay Launch Logic:** Visually tracks the memory cleared, displays the exact MB freed, and executes the game shortcut seamlessly.
- 🧳 **Portable Engine:** No installation required. Run the single `.exe` from anywhere on your PC. Settings are remembered forever.

## 📈 Performance Gains

*Benchmarks for 1080P Low Settings:*

| Metric | Without Launcher | With Launcher |
|--------|------------------|---------------|
| **FPS** | 175 - 181 FPS | **183 - 190 FPS** |
| **System RAM Usage** | 26.7 GB | **18.4 GB** |

> *Note: RAM usage reflects total system RAM allocation. No background processes are forcefully closed; the gains are achieved purely through intelligent memory allocation optimization, SMT disabling, and Process Priority adjustments.*

## 🛡️ Is it Safe? (Anti-Cheat Friendly)

**YES, it is 100% safe.**

This application is an external system bootstrapper. It optimizes your Windows RAM Environment and hardware efficiency without *ever* touching the game files.
- **Official Tools:** Memory cleaning is driven by Microsoft's digitally signed RAMMap. Not a cheat, hack, or injector.
- **Zero Modding:** It does not modify game code or interfere with any Anti-Cheat (Vanguard/VAC) rings. 

## 📖 Quick Start

### 1. First-Time Setup
1. **Download** the latest release and extract the folder.
2. Run `Deadlock Optimized Launcher.exe` as an **Administrator** *(required for deep Windows memory clearance)*.
3. **Auto-Search:** Click "Auto-Search" in the Launch Configuration. It will instantly locate your Deadlock shortcut.
4. Click **OPTIMIZE & LAUNCH GAME**. Your PC memory will be sequentially cleaned, and Deadlock will boot with maximum available resources.

### 2. Daily Use
Open the launcher and click **OPTIMIZE & LAUNCH GAME** every single time you want to play! 

---
<div align="center">
<i>Built with ❤️ for the Deadlock Community</i>
</div>
