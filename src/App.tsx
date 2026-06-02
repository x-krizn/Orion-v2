/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Cpu,
  Activity,
  Zap,
  Crosshair,
  Sliders,
  Layers,
  Circle,
  HelpCircle,
  Sparkles,
  RefreshCw,
  Sun,
  Camera,
  Play,
  RotateCcw,
  Upload,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { GameManager } from "./game/game/GameManager";
import { PerformanceStats, ModelAssetInfo } from "./game/types";
import { SandboxConfigPanel } from "./components/SandboxConfigPanel";
import { FXWorkbenchPanel } from "./components/FXWorkbenchPanel";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameManagerRef = useRef<GameManager | null>(null);

  // Performance hooks
  const [stats, setStats] = useState<PerformanceStats>({
    fps: 0,
    frameTime: 0,
    drawCalls: 0,
    meshCount: 0,
    activeParticles: 0,
    verticesCount: 0,
  });

  // UI state hooks
  const [theme, setTheme] = useState<"cyber" | "magma" | "wasteland" | "matrix">("magma");
  const [dndMode, setDndMode] = useState<"character" | "environment">("environment");
  const [customAssets, setCustomAssets] = useState<ModelAssetInfo[]>([]);
  const [controlsCollapsed, setControlsCollapsed] = useState<boolean>(false);

  // Modular Asset Library states
  const [libraryItems, setLibraryItems] = useState<{ id: string; name: string }[]>([]);
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<string | null>(null);
  const [placementMode, setPlacementMode] = useState<boolean>(false);

  // App mode: whether we are playing or editing
  const [appMode] = useState<"play" | "edit">(() => {
    const urlParams = new URL(window.location.href).searchParams;
    return urlParams.get("mode") === "edit" ? "edit" : "play";
  });

  // PWA installer hooks
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    
    // Check if running in standalone display mode
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone) {
      console.log("Welcome back pilot! Game client launched successfully via standalone client.");
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  // User asset calibration multipliers
  const [customChassisScale, setCustomChassisScale] = useState<number>(1.0);
  const [customChassisRotation, setCustomChassisRotation] = useState<number>(180);
  const [customPropsScale, setCustomPropsScale] = useState<number>(1.0);
  const [customPropsRotation, setCustomPropsRotation] = useState<number>(0);
  
  // Precision alignment and customization settings (useful for Blockbench refining)
  const [chassisOffsetX, setChassisOffsetX] = useState<number>(0);
  const [chassisOffsetY, setChassisOffsetY] = useState<number>(0);
  const [chassisOffsetZ, setChassisOffsetZ] = useState<number>(0);
  const [muzzleOffsetX, setMuzzleOffsetX] = useState<number>(0);
  const [muzzleOffsetY, setMuzzleOffsetY] = useState<number>(0);
  const [muzzleOffsetZ, setMuzzleOffsetZ] = useState<number>(0);
  const [bobbingHeight, setBobbingHeight] = useState<number>(0.08);
  const [bobbingSpeed, setBobbingSpeed] = useState<number>(1.0);
  const [tiltPitch, setTiltPitch] = useState<number>(0.12);
  const [swayRoll, setSwayRoll] = useState<number>(0.04);
  const [collisionRadius, setCollisionRadius] = useState<number>(0.7);
  const [showAdvancedCalibration, setShowAdvancedCalibration] = useState<boolean>(false);
  
  // Custom interactive controls state
  const [glowIntensity, setGlowIntensity] = useState<number>(0.85);
  const [bloomWeight, setBloomWeight] = useState<number>(0.5);
  const [exposure, setExposure] = useState<number>(1.1);
  const [fov, setFov] = useState<number>(0.35);
  const [cameraDist, setCameraDist] = useState<number>(36);
  const [pitch, setPitch] = useState<number>(40);
  const [activeTab, setActiveTab] = useState<"settings" | "effects" | "help" | "json" | "loadouts">("loadouts");
  const [showJoystick, setShowJoystick] = useState<boolean>(true);
  const [showTelemetry, setShowTelemetry] = useState<boolean>(true);
  const [showFXWorkbench, setShowFXWorkbench] = useState<boolean>(false);

  // Dynamic loaded game database states
  const [weapons, setWeapons] = useState<any[]>([]);
  const [abilities, setAbilities] = useState<any[]>([]);
  const [statusEffects, setStatusEffects] = useState<any[]>([]);
  const [maps, setMaps] = useState<any[]>([]);
  const [enemies, setEnemies] = useState<any[]>([]);
  const [equippedWeaponId, setEquippedWeaponId] = useState<string>("pulse_cannon");
  const [activePlayerStatus, setActivePlayerStatus] = useState<any>(null);
  const [statusTimeLeft, setStatusTimeLeft] = useState<number>(0);

  // Active cooldown ratios
  const [dashCooldown, setDashCooldown] = useState<number>(0);

  // Touch joystick mechanical controls
  const joystickBoundRef = useRef<HTMLDivElement | null>(null);
  const joystickKnobRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingJoystick, setIsDraggingJoystick] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Instantiate game coordinator
    const gm = new GameManager(
      canvasRef.current,
      (assets) => {
        setCustomAssets(assets);
      },
      (libItems) => {
        setLibraryItems(libItems);
        if (libItems.length > 0) {
          setSelectedLibraryItem(libItems[0].id);
        } else {
          setSelectedLibraryItem(null);
          setPlacementMode(false);
        }
      }
    );

    // Bind data loading listeners to React state
    gm.onWeaponsLoaded = (weaps) => setWeapons(weaps);
    gm.onAbilitiesLoaded = (abils) => setAbilities(abils);
    gm.onStatusEffectsLoaded = (effects) => setStatusEffects(effects);
    gm.onMapsLoaded = (mList) => setMaps(mList);
    gm.onEnemiesLoaded = (eList) => setEnemies(eList);
    
    // Wire performance telemetry callbacks
    gm.addPerformanceListener((latestStats) => {
      setStats(latestStats);
      setDashCooldown(gm.player.getDashCooldownProgress());
      
      // Update dynamic live HUD trackers
      setEquippedWeaponId(gm.equippedWeaponId);
      setActivePlayerStatus(gm.player.getActiveStatusEffect());
      setStatusTimeLeft(gm.player.getStatusEffectRemaining());
    });

    gameManagerRef.current = gm;

    // Hotkey handler to block page scrolling with arrows/space
    const blockKeys = (e: KeyboardEvent) => {
      if (["space", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", blockKeys);

    return () => {
      gm.dispose();
      window.removeEventListener("keydown", blockKeys);
    };
  }, []);

  // Synchronize placement tracking states
  useEffect(() => {
    if (gameManagerRef.current) {
      gameManagerRef.current.selectedLibraryItemId = selectedLibraryItem;
    }
  }, [selectedLibraryItem]);

  useEffect(() => {
    if (gameManagerRef.current) {
      gameManagerRef.current.placementModeActive = placementMode;
    }
  }, [placementMode]);

  // Sync state togglers
  const handleThemeChange = (newTheme: "cyber" | "magma" | "wasteland" | "matrix") => {
    setTheme(newTheme);
    gameManagerRef.current?.changeTheme(newTheme);
  };

  const handleDndModeToggle = (mode: "character" | "environment") => {
    setDndMode(mode);
    if (gameManagerRef.current) {
      gameManagerRef.current.dndMode = mode;
    }
  };

  const handleGlowIntensityChange = (val: number) => {
    setGlowIntensity(val);
    gameManagerRef.current?.updateRenderingSettings("glowIntensity", val);
  };

  const handleBloomWeightChange = (val: number) => {
    setBloomWeight(val);
    gameManagerRef.current?.updateRenderingSettings("bloomWeight", val);
  };

  const handleExposureChange = (val: number) => {
    setExposure(val);
    gameManagerRef.current?.updateRenderingSettings("exposure", val);
  };

  const handleFovChange = (val: number) => {
    setFov(val);
    gameManagerRef.current?.updateCameraConfig("fov", val);
  };

  const handleCameraDistChange = (val: number) => {
    setCameraDist(val);
    gameManagerRef.current?.updateCameraConfig("distance", val);
  };

  const handlePitchChange = (val: number) => {
    setPitch(val);
    gameManagerRef.current?.updateCameraConfig("pitch", val * (Math.PI / 180));
  };

  const handleClearAssets = () => {
    gameManagerRef.current?.environment.clearCustomAssets();
    gameManagerRef.current?.player.hideProceduralModel(false);
    setCustomAssets([]);
    setLibraryItems([]);
    setSelectedLibraryItem(null);
    setPlacementMode(false);
    setCustomChassisScale(1.0);
    setCustomChassisRotation(180);
    setCustomPropsScale(1.0);
    setCustomPropsRotation(0);
    
    setChassisOffsetX(0);
    setChassisOffsetY(0);
    setChassisOffsetZ(0);
    setMuzzleOffsetX(0);
    setMuzzleOffsetY(0);
    setMuzzleOffsetZ(0);
    setBobbingHeight(0.08);
    setBobbingSpeed(1.0);
    setTiltPitch(0.12);
    setSwayRoll(0.04);
    setCollisionRadius(0.7);
  };

  // Precision alignments update loop
  useEffect(() => {
    if (gameManagerRef.current) {
      gameManagerRef.current.setCustomChassisAlignment({
        offsetX: chassisOffsetX,
        offsetY: chassisOffsetY,
        offsetZ: chassisOffsetZ,
        muzzleOffsetX: muzzleOffsetX,
        muzzleOffsetY: muzzleOffsetY,
        muzzleOffsetZ: muzzleOffsetZ,
        bobbingHeight: bobbingHeight,
        bobbingSpeed: bobbingSpeed,
        tiltPitch: tiltPitch,
        swayRoll: swayRoll,
        collisionRadius: collisionRadius,
      });
    }
  }, [
    chassisOffsetX,
    chassisOffsetY,
    chassisOffsetZ,
    muzzleOffsetX,
    muzzleOffsetY,
    muzzleOffsetZ,
    bobbingHeight,
    bobbingSpeed,
    tiltPitch,
    swayRoll,
    collisionRadius,
  ]);

  const handleAutoArrange = () => {
    gameManagerRef.current?.environment.autoArrangeLibrary();
  };

  const handleCustomChassisScaleChange = (val: number) => {
    setCustomChassisScale(val);
    gameManagerRef.current?.setCustomChassisTransforms(val, customChassisRotation);
  };

  const handleCustomChassisRotationChange = (val: number) => {
    setCustomChassisRotation(val);
    gameManagerRef.current?.setCustomChassisTransforms(customChassisScale, val);
  };

  const handleCustomPropsScaleChange = (val: number) => {
    setCustomPropsScale(val);
    gameManagerRef.current?.setCustomPropsTransforms(val, customPropsRotation);
  };

  const handleCustomPropsRotationChange = (val: number) => {
    setCustomPropsRotation(val);
    gameManagerRef.current?.setCustomPropsTransforms(customPropsScale, val);
  };

  const handleManualFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await gameManagerRef.current?.handleInjectedFile(file);
    e.target.value = "";
  };

  // ----------------------------------------------------
  // Virtual Joysticks drag logic
  // ----------------------------------------------------
  const handleJoystickTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDraggingJoystick(true);
    updateJoystickPos(e);
  };

  const handleJoystickTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDraggingJoystick) return;
    updateJoystickPos(e);
  };

  const handleJoystickTouchEnd = () => {
    setIsDraggingJoystick(false);
    if (joystickKnobRef.current) {
      joystickKnobRef.current.style.transform = `translate(0px, 0px)`;
    }
    gameManagerRef.current?.input.handleJoystickUpdate(0, 0, false);
  };

  const updateJoystickPos = (e: React.TouchEvent | React.MouseEvent) => {
    if (!joystickBoundRef.current || !joystickKnobRef.current) return;

    const boundRect = joystickBoundRef.current.getBoundingClientRect();
    const boundCenterX = boundRect.left + boundRect.width / 2;
    const boundCenterY = boundRect.top + boundRect.height / 2;

    let clientX = 0;
    let clientY = 0;

    if ("touches" in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const dx = clientX - boundCenterX;
    const dy = clientY - boundCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const maxRadius = 45; // clamp range boundary
    let finalDx = dx;
    let finalDy = dy;

    if (dist > maxRadius) {
      finalDx = (dx / dist) * maxRadius;
      finalDy = (dy / dist) * maxRadius;
    }

    joystickKnobRef.current.style.transform = `translate(${finalDx}px, ${finalDy}px)`;

    // Transmute into normal ranges -1 to 1 for direction update
    const normX = finalDx / maxRadius;
    const normY = finalDy / maxRadius;
    gameManagerRef.current?.input.handleJoystickUpdate(normX, normY, true);
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-[#0a0a0c] text-[#d1d1d6] font-sans" id="appRoot">
      
      {/* 3D Render Canvas */}
      <canvas
        id="renderCanvas"
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block touch-none z-0"
      />

      {/* Grid Scanline aesthetics overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_50%,rgba(0,0,0,0.6)_100%)] z-1" />

      {/* Cybernetic HUD overlay: Header Title info */}
      <header className="absolute top-4 left-4 z-4 flex items-center justify-between pointer-events-none w-[calc(100%-2rem)]">
        <div className="pointer-events-auto flex items-center space-x-3 cyber-panel py-2 px-4 rounded-md border-white/10 bg-[#0f0f12]/90 backdrop-blur-md">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded flex items-center justify-center font-bold text-black text-xs font-mono mr-1 shadow-md shadow-orange-500/20">
            M.C
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-mono font-bold tracking-widest text-white leading-none">2.5D MECH VERTICAL SLICE</h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="px-1.5 py-0.5 bg-green-500/10 text-green-400 text-[9px] rounded border border-green-500/20 uppercase font-mono font-bold leading-none">
                System Stable
              </span>
              <span className="text-[10px] font-mono text-orange-400 uppercase tracking-tight mr-1">ENG_SYS_ACTIVE</span>
              <button
                id="telemetryToggleButton"
                onClick={() => setShowTelemetry(!showTelemetry)}
                className="pointer-events-auto px-2 py-0.5 bg-orange-500/20 hover:bg-orange-500/35 border border-orange-500 text-white hover:text-orange-200 text-[9px] rounded font-mono font-bold uppercase transition-all flex items-center gap-1 cursor-pointer"
              >
                <Activity className="w-2.5 h-2.5 animate-pulse text-orange-400" />
                <span>Diagnostics: {showTelemetry ? "ON" : "OFF"}</span>
              </button>
              <button
                id="fxWorkbenchToggleButton"
                onClick={() => setShowFXWorkbench(!showFXWorkbench)}
                className={`pointer-events-auto px-2 py-0.5 border text-white text-[9px] rounded font-mono font-bold uppercase transition-all flex items-center gap-1 cursor-pointer leading-none ${
                  showFXWorkbench
                    ? "bg-orange-500 hover:bg-orange-600 text-black font-semibold border-orange-500"
                    : "bg-orange-500/15 hover:bg-orange-500/35 border-orange-500 hover:text-orange-200"
                }`}
              >
                <Sliders className="w-2.5 h-2.5 text-orange-400" />
                <span>FX Workbench</span>
              </button>
              {isInstallable && (
                <button
                  id="pwaInstallButton"
                  onClick={handleInstallClick}
                  className="pointer-events-auto px-2 py-0.5 bg-blue-500/20 hover:bg-blue-500/35 border border-blue-500 text-white hover:text-blue-200 text-[9px] rounded font-mono font-bold uppercase transition-all flex items-center gap-1 cursor-pointer"
                  title="Install Mech Combat Sandbox offline client"
                >
                  <Download className="w-2.5 h-2.5 text-blue-400" />
                  <span>Install Client</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Drag & Drop Hint Overlay banner */}
        {appMode === "edit" && (
        <div className="hidden md:flex pointer-events-auto items-center space-x-3 cyber-panel py-2 px-4 rounded-md border-white/10 bg-[#0f0f12]/90 backdrop-blur-md">
          <Sparkles className="w-4 h-4 text-orange-500 animate-pulse" />
          <span className="text-xs font-mono text-orange-300">
            DRAG & DROP <strong className="text-white font-bold font-sans">.GLB / .GLTF</strong> ON MAP TO SPAWN AS{" "}
            <span className="text-orange-400 font-bold">{dndMode.toUpperCase()}</span>
          </span>
        </div>
        )}
      </header>

      {/* Left Bottom Panel: Mobile Touch joystick */}
      {showJoystick && (
        <div className="absolute bottom-6 left-6 z-4 block pointer-events-auto select-none">
          <div className="flex flex-col items-center space-y-2">
            <div
              id="virtualJoystickContainer"
              ref={joystickBoundRef}
              onMouseDown={handleJoystickTouchStart}
              onMouseMove={handleJoystickTouchMove}
              onMouseUp={handleJoystickTouchEnd}
              onMouseLeave={handleJoystickTouchEnd}
              onTouchStart={handleJoystickTouchStart}
              onTouchMove={handleJoystickTouchMove}
              onTouchEnd={handleJoystickTouchEnd}
              className="w-28 h-28 rounded-full border-2 border-orange-500/20 bg-black/60 flex items-center justify-center cursor-crosshair shadow-lg touch-none"
            >
              <div
                id="joystickKnob"
                ref={joystickKnobRef}
                className="w-11 h-11 rounded-full bg-gradient-to-tr from-orange-600 to-orange-400 border border-orange-300 shadow-lg select-none pointer-events-none transition-transform duration-75 ease-out"
              />
            </div>
            <span className="text-[10px] font-mono text-orange-500 font-bold tracking-widest">THRUST JOYSTICK</span>
          </div>
        </div>
      )}

      {/* Right Bottom HUD: Tactical Abilities / Weapon Loadout control deck */}
      <div className="absolute bottom-6 right-6 z-4 cyber-panel p-3 rounded-lg flex items-center space-x-4 pointer-events-auto shadow-xl bg-[#0f0f12]/90 backdrop-blur-md border-white/10">
        <div className="flex flex-col items-center justify-center border-r border-[#d1d1d6]/10 pr-3 mr-1">
          <Zap className="w-5 h-5 text-yellow-400 animate-pulse" />
          <span className="text-[9px] font-mono text-slate-500 mt-1">LOADOUT</span>
        </div>

        {/* 1. Standard Plasma Cannons */}
        <button
          id="laserWeaponButton"
          onClick={() => gameManagerRef.current?.input.triggerAbility(0)}
          className="relative flex flex-col items-center p-2 rounded border border-orange-500/20 hover:border-orange-500 bg-black/60 transition-all text-slate-300 hover:text-orange-300 w-16 cursor-pointer"
        >
          <Crosshair className="w-5 h-5 mb-1 text-orange-500" />
          <span className="text-[9px] font-mono font-bold leading-none">PLASMA</span>
          <span className="text-[8px] font-mono text-orange-500 mt-1">L-CLICK</span>
        </button>

        {/* 2. Heavy fusion beam */}
        <button
          id="heavyBeamButton"
          onClick={() => gameManagerRef.current?.input.triggerAbility(1)}
          className="relative flex flex-col items-center p-2 rounded border border-rose-500/20 hover:border-rose-400 bg-slate-900/60 transition-all text-slate-300 hover:text-rose-200 w-16 cursor-pointer"
        >
          <div className="relative">
            <Zap className="w-5 h-5 mb-1 text-rose-400" />
          </div>
          <span className="text-[9px] font-mono font-bold leading-none">RAILBEAM</span>
          <span className="text-[8px] font-mono text-rose-500 mt-1">Q / 1</span>
        </button>

        {/* 3. mortar bombardment */}
        <button
          id="orbitalBombButton"
          onClick={() => gameManagerRef.current?.input.triggerAbility(2)}
          className="relative flex flex-col items-center p-2 rounded border border-amber-500/20 hover:border-amber-400 bg-slate-900/60 transition-all text-slate-300 hover:text-amber-200 w-16 cursor-pointer"
        >
          <Sparkles className="w-5 h-5 mb-1 text-amber-400" />
          <span className="text-[9px] font-mono font-bold leading-none">MORTAR</span>
          <span className="text-[8px] font-mono text-amber-500 mt-1">E / 2</span>
        </button>

        {/* 4. Dash propulsion */}
        <button
          id="dashAbilityButton"
          disabled={dashCooldown > 0}
          onClick={() => gameManagerRef.current?.input.triggerDash()}
          className={`relative flex flex-col items-center p-2 rounded border w-16 transition-all cursor-pointer ${
            dashCooldown > 0
              ? "border-slate-800 bg-[#0f0f12]/40 text-slate-600 cursor-not-allowed"
              : "border-emerald-500/20 hover:border-emerald-400 bg-slate-900/60 text-slate-300 hover:text-emerald-200"
          }`}
        >
          {dashCooldown > 0 ? (
            <div className="text-xs font-mono font-bold text-center h-5 flex items-center justify-center text-emerald-400">
              {dashCooldown.toFixed(1)}s
            </div>
          ) : (
            <RefreshCw className="w-5 h-5 mb-1 text-emerald-400" />
          )}
          <span className="text-[9px] font-mono font-bold leading-none">DASH</span>
          <span className="text-[8px] font-mono text-emerald-500 mt-1">SPACE</span>
        </button>
      </div>

      {/* Floating Telemetry Diagnostics Overlay */}
      {showTelemetry && (
        <div className="absolute top-24 left-4 z-4 cyber-panel p-3.5 rounded-lg min-w-[210px] w-56 font-mono shadow-2xl text-[11px] leading-relaxed border-white/10 bg-[#0f0f12]/90 backdrop-blur-md pointer-events-auto">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2">
            <div className="flex items-center space-x-1">
              <Activity className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
              <span className="font-bold text-white tracking-wider">TELEMETRY DIAGS</span>
            </div>
            <button
              onClick={() => setShowTelemetry(false)}
              className="text-[#d1d1d6]/50 hover:text-white transition-all text-[10px] font-bold px-1 hover:bg-white/5 rounded cursor-pointer"
              title="Close Panel"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-y-1 text-[#d1d1d6]">
            <span>ENGINE FPS:</span>
            <span className="text-right font-bold text-green-400">{stats.fps} FPS</span>

            <span>LATENCY:</span>
            <span className="text-right font-bold text-orange-400">{stats.frameTime} ms</span>

            <span>DRAW CALLS:</span>
            <span className="text-right text-slate-200 font-bold">{stats.drawCalls}</span>

            <span>ACTIVE FX:</span>
            <span className="text-right text-rose-400 font-bold">{stats.activeParticles}</span>

            <span>TOTAL MESHES:</span>
            <span className="text-right text-slate-200">{stats.meshCount}</span>

            <span>VERTICES:</span>
            <span className="text-right text-slate-300">{stats.verticesCount.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Right Core Control panel sidebar */}
      {appMode === "edit" && (
      <div className={`absolute top-20 z-4 transition-all duration-300 ease-in-out flex items-start pointer-events-none ${
        controlsCollapsed ? "right-0 translate-x-[320px]" : "right-4 translate-x-0"
      }`}>
        {/* Toggle sliding tab button */}
        <button
          onClick={() => setControlsCollapsed(!controlsCollapsed)}
          className="pointer-events-auto p-1 bg-[#0f0f12]/95 border border-white/10 hover:border-orange-500/40 border-r-0 rounded-l-md hover:bg-orange-500/10 text-orange-400 hover:text-white transition-all shadow-xl font-mono mt-4 flex flex-col items-center justify-center cursor-pointer select-none w-6 py-3"
          title={controlsCollapsed ? "Expand Sandbox Controls" : "Collapse Toolbox"}
        >
          {controlsCollapsed ? (
            <>
              <ChevronLeft className="w-3.5 h-3.5 mb-1 text-green-400 animate-pulse" />
              <div className="flex flex-col items-center text-[7px] font-bold text-green-400 leading-none space-y-0.5">
                <span>O</span>
                <span>P</span>
                <span>E</span>
                <span>N</span>
              </div>
            </>
          ) : (
            <>
              <ChevronRight className="w-3.5 h-3.5 mb-1 text-orange-500" />
              <div className="flex flex-col items-center text-[7px] font-bold text-[#d1d1d6]/50 leading-none space-y-0.5">
                <span>H</span>
                <span>I</span>
                <span>D</span>
                <span>E</span>
              </div>
            </>
          )}
        </button>

        {/* Panel Content container */}
        <div className="cyber-panel w-80 rounded-r-lg rounded-b-lg p-4 shadow-2xl max-h-[calc(100vh-14rem)] overflow-y-auto pointer-events-auto border-white/5 bg-[#0f0f12]/90 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
          <div className="flex items-center space-x-1.5">
            <Cpu className="w-4 h-4 text-orange-500" />
            <h2 className="text-xs font-bold tracking-wider text-white">TACTICAL DECK CONTROLS</h2>
          </div>
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab("settings")}
              className={`p-1 px-2.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                activeTab === "settings"
                  ? "bg-orange-500/15 border-orange-500 text-orange-400 font-bold"
                  : "border-white/5 text-white/50 hover:text-white"
              }`}
            >
              CAMERA
            </button>
            <button
              onClick={() => setActiveTab("loadouts")}
              className={`p-1 px-2.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                activeTab === "loadouts"
                  ? "bg-orange-500/15 border-orange-500 text-orange-400 font-bold"
                  : "border-white/5 text-white/50 hover:text-white"
              }`}
            >
              LOADOUTS
            </button>
            <button
              onClick={() => setActiveTab("effects")}
              className={`p-1 px-2.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                activeTab === "effects"
                  ? "bg-orange-500/15 border-orange-500 text-orange-400 font-bold"
                  : "border-[#d1d1d6]/5 hover:text-white"
              }`}
            >
              SHADERS
            </button>
            <button
              onClick={() => setActiveTab("help")}
              className={`p-1 px-2.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                activeTab === "help"
                  ? "bg-orange-500/15 border-orange-500 text-orange-400 font-bold"
                  : "border-white/5 text-white/50 hover:text-white"
              }`}
            >
              KEYS
            </button>
            <button
              id="sandboxJsonButton"
              onClick={() => setActiveTab("json")}
              className={`p-1 px-2.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                activeTab === "json"
                  ? "bg-orange-500/15 border-orange-500 text-orange-400 font-bold"
                  : "border-white/5 text-white/50 hover:text-white"
              }`}
            >
              JSON
            </button>
          </div>
        </div>

        {activeTab === "loadouts" && (
          <div className="space-y-4">
            {/* Equipped Weapon indicator & inventory */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 block tracking-widest mb-1.5 uppercase">
                ⚔️ PRIMARY WEAPON ARSENAL
              </span>
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {weapons.map((w) => {
                  const isEquipped = equippedWeaponId === w.id;
                  return (
                    <button
                      key={w.id}
                      onClick={() => {
                        gameManagerRef.current?.equipWeapon(w.id);
                        setEquippedWeaponId(w.id);
                      }}
                      className={`w-full text-left p-2 rounded border text-xs font-mono transition-all cursor-pointer flex items-center justify-between ${
                        isEquipped
                          ? "bg-orange-500/15 border-orange-500 text-white font-bold"
                          : "border-white/5 bg-black/40 text-slate-300 hover:text-white"
                      }`}
                    >
                      <div>
                        <div className="flex items-center space-x-1.5 font-sans">
                          <span className={`font-mono ${
                            w.rarity === "legendary" ? "text-yellow-400 font-bold" :
                            w.rarity === "epic" ? "text-purple-400" :
                            w.rarity === "rare" ? "text-blue-400" : "text-slate-400"
                          } uppercase text-[9px] font-semibold tracking-wider p-0.5 px-1 bg-black/40 rounded`}>
                            {w.rarity}
                          </span>
                          <span className="font-mono">{w.name}</span>
                        </div>
                        <p className="text-[10px] text-[#cbd5e1] font-sans mt-0.5 leading-none">
                          {w.description}
                        </p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="text-orange-400 font-bold text-[10px]">DMG: {w.damage}</span>
                        <span className="text-[9px] text-[#cbd5e1]/60">{w.cooldown}s CD</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status effects */}
            <div className="border-t border-white/5 pt-3">
              <span className="text-[10px] font-bold text-[#b45309] block tracking-widest mb-2 uppercase font-bold">
                🧬 TACTICAL STATUS BOOSTER
              </span>
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                {statusEffects.map((effect) => {
                  const isActive = activePlayerStatus && activePlayerStatus.id === effect.id;
                  return (
                    <button
                      key={effect.id}
                      style={{ color: "#cbd5e1" }}
                      onClick={() => {
                        gameManagerRef.current?.triggerPlayerStatusEffect(effect.id);
                        setActivePlayerStatus(effect);
                      }}
                      className={`text-center p-1.5 rounded border text-[10px] font-mono transition-all cursor-pointer flex flex-col items-center justify-center ${
                        isActive
                          ? "bg-[#ff6f00]/15 border-orange-500 text-white font-bold shadow-[0_0_8px_rgba(255,111,0,0.2)]"
                          : "border-white/5 bg-black/40 hover:text-white"
                      }`}
                    >
                      <span className="font-bold flex items-center space-x-1 uppercase text-[9px]">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `rgb(${effect.particleColor.r * 255}, ${effect.particleColor.g * 255}, ${effect.particleColor.b * 255})` }} />
                        <span>{effect.name}</span>
                      </span>
                      <span className="text-[8px] text-[#94a3b8] mt-0.5 font-sans leading-tight">
                        {effect.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active boost status card if present */}
              {activePlayerStatus && (
                <div className="p-2 rounded border border-orange-500/20 bg-[#120f0d]/90 font-mono text-[10px] leading-relaxed flex items-center justify-between">
                  <div>
                    <span className="text-orange-400 font-bold block uppercase tracking-widest text-[9px]">
                      ⚡ ACTIVE SYSTEM OVERLAYS
                    </span>
                    <span className="text-white text-[11px] font-bold uppercase">{activePlayerStatus.name}</span>
                    <div className="grid grid-cols-2 gap-x-2 text-slate-400 text-[9px] mt-1">
                      {activePlayerStatus.modifiers.speedMult !== undefined && (
                        <span>SPEED: {activePlayerStatus.modifiers.speedMult > 1 ? "+" : ""}{((activePlayerStatus.modifiers.speedMult - 1) * 100).toFixed(0)}%</span>
                      )}
                      {activePlayerStatus.modifiers.damageMult !== undefined && (
                        <span>DMG: {activePlayerStatus.modifiers.damageMult > 1 ? "+" : ""}{((activePlayerStatus.modifiers.damageMult - 1) * 100).toFixed(0)}%</span>
                      )}
                      {activePlayerStatus.modifiers.cooldownMult !== undefined && (
                        <span>COOLDOWN: {activePlayerStatus.modifiers.cooldownMult < 1 ? "-" : "+"}{Math.abs((activePlayerStatus.modifiers.cooldownMult - 1) * 100).toFixed(0)}%</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[#cbd5e1]/40 block uppercase font-bold text-[8px]">REMAINING</span>
                    <span className="text-orange-400 font-bold text-[14px]">{statusTimeLeft.toFixed(1)}s</span>
                  </div>
                </div>
              )}
            </div>

            {/* Sandbox spawner settings indicator */}
            <div className="border-t border-white/5 pt-3">
              <span className="text-[10px] font-bold text-slate-400 block tracking-widest mb-1.5 uppercase">
                💀 SANDBOX COHORT SPAWNER (CLICK GROUND)
              </span>
              <p className="text-[10px] text-[#cbd5e1]/70 font-sans mb-2 leading-tight">
                To spawn entities matching templates, select them in <strong className="text-orange-500">ASSET BUILDER</strong> below and click the floor coordinates.
              </p>
              <div className="space-y-1 bg-black/30 p-1.5 rounded border border-white/5">
                <span className="text-[9px] font-bold text-[#b45309] uppercase tracking-widest block font-mono">
                  Loaded Templates ({enemies.length})
                </span>
                <div className="grid grid-cols-2 gap-1 font-mono text-[9px]">
                  {enemies.map((e) => (
                    <div key={e.id} className="p-1 rounded bg-[#09090c] border border-white/5 flex flex-col leading-none">
                      <span className="font-bold text-[#f8fafc] truncate" style={{ borderLeft: `2.5px solid rgb(${e.color.r * 255}, ${e.color.g * 255}, ${e.color.b * 255})`, paddingLeft: "3.5px" }}>
                        {e.name}
                      </span>
                      <div className="flex justify-between items-center text-slate-400 mt-1 max-w-full">
                        <span>HP: {e.health}</span>
                        <span>SF: {e.scale}x</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-4">
            {/* Theme picker */}
            <div>
              <span className="text-[10px] font-bold text-white/50 tracking-widest block mb-2 uppercase">Arena Map Theme</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "cyber", label: "NEON GRID", color: "text-cyan-400" },
                  { id: "magma", label: "HELLFIRE", color: "text-orange-500 font-bold" },
                  { id: "matrix", label: "MATRIX LAB", color: "text-emerald-400" },
                  { id: "wasteland", label: "DUST DUNES", color: "text-amber-500" },
                ].map((th) => (
                  <button
                    key={th.id}
                    onClick={() => handleThemeChange(th.id as any)}
                    className={`flex items-center justify-center p-2 rounded border text-xs font-mono transition-all cursor-pointer ${
                      theme === th.id
                        ? "bg-orange-500/10 border-orange-500 text-white font-bold"
                        : "border-white/5 bg-black/40 text-[#d1d1d6] hover:text-white"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full mr-2 bg-current" style={{ color: theme === th.id ? "" : "transparent" }} />
                    <span className={th.color}>{th.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* GLB Upload configuration target zone */}
            <div className="border border-white/5 rounded bg-black/40 p-2.5 space-y-2.5">
              <span className="text-[10px] font-bold text-white/50 block uppercase tracking-widest">GLB Sandbox Allocation Target</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  id="spawnAsPropButton"
                  onClick={() => handleDndModeToggle("environment")}
                  className={`p-1.5 rounded text-xs font-mono border transition-all cursor-pointer ${
                    dndMode === "environment"
                      ? "bg-orange-500/20 border-orange-400 text-white font-bold"
                      : "border-white/5 text-white/50 hover:text-[#d1d1d6]"
                  }`}
                >
                  MAP PROPS
                </button>
                <button
                  id="spawnAsCharaButton"
                  onClick={() => handleDndModeToggle("character")}
                  className={`p-1.5 rounded text-xs font-mono border transition-all cursor-pointer ${
                    dndMode === "character"
                      ? "bg-orange-500/20 border-orange-400 text-white font-bold"
                      : "border-white/5 text-white/50 hover:text-[#d1d1d6]"
                  }`}
                >
                  MECH CHASSIS
                </button>
              </div>

              {/* Manual Upload Trigger for Mobile Compat */}
              <div className="relative pt-1 border-t border-white/5">
                <input
                  id="manualGlbFileInput"
                  type="file"
                  accept=".glb,.gltf"
                  className="hidden"
                  onChange={handleManualFileUpload}
                />
                <button
                  onClick={() => document.getElementById("manualGlbFileInput")?.click()}
                  className="w-full flex items-center justify-center space-x-1.5 p-2 rounded border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 hover:text-white transition-all font-mono text-[10px] cursor-pointer text-center uppercase tracking-wider"
                >
                  <Upload className="w-3.5 h-3.5 animate-pulse" />
                  <span>TAP TO SELECT TEST GLB</span>
                </button>
                <p className="text-[9px] text-[#d1d1d6]/45 font-mono text-center mt-1 leading-normal">
                  Upload <strong className="text-orange-400">warriorTest.glb</strong> as <span className="text-[#d1d1d6]">MECH CHASSIS</span> or <strong className="text-orange-400">enviroTest.glb</strong> as <span className="text-[#d1d1d6]">MAP PROPS</span>.
                </p>
              </div>
            </div>

            {/* Custom Asset Adjustments panel */}
            <div className="border border-white/5 rounded bg-black/40 p-2.5 space-y-3">
              <span className="text-[10px] font-bold text-white/50 block uppercase tracking-widest">Transform Overrides</span>
              
              {/* Chassis calibration */}
              <div className="space-y-2 pb-2.5 border-b border-white/5">
                <span className="text-[9px] font-mono font-bold text-orange-400 block uppercase">MECH CHASSIS OVERRIDES</span>
                <div>
                  <div className="flex justify-between text-[10px] font-mono text-[#d1d1d6]">
                    <span>CHASSIS SCALE:</span>
                    <span className="text-orange-400 font-bold">{customChassisScale.toFixed(2)}x</span>
                  </div>
                  <input
                    id="mechScaleSlider"
                    type="range"
                    min="0.1"
                    max="4.0"
                    step="0.05"
                    value={customChassisScale}
                    onChange={(e) => handleCustomChassisScaleChange(parseFloat(e.target.value))}
                    className="w-full accent-orange-500 bg-white/10 h-1 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-mono text-[#d1d1d6]">
                    <span>CHASSIS ROTATION:</span>
                    <span className="text-orange-400 font-bold">{customChassisRotation}°</span>
                  </div>
                  <input
                    id="mechRotSlider"
                    type="range"
                    min="0"
                    max="360"
                    step="5"
                    value={customChassisRotation}
                    onChange={(e) => handleCustomChassisRotationChange(parseInt(e.target.value))}
                    className="w-full accent-orange-500 bg-white/10 h-1 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Props calibration */}
              <div className="space-y-2">
                <span className="text-[9px] font-mono font-bold text-orange-400 block uppercase">MAP PROPS OVERRIDES</span>
                <div>
                  <div className="flex justify-between text-[10px] font-mono text-[#d1d1d6]">
                    <span>PROPS SCALE:</span>
                    <span className="text-orange-400 font-bold">{customPropsScale.toFixed(2)}x</span>
                  </div>
                  <input
                    id="propScaleSlider"
                    type="range"
                    min="0.1"
                    max="4.0"
                    step="0.05"
                    value={customPropsScale}
                    onChange={(e) => handleCustomPropsScaleChange(parseFloat(e.target.value))}
                    className="w-full accent-orange-500 bg-white/10 h-1 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-mono text-[#d1d1d6]">
                    <span>PROPS ROTATION:</span>
                    <span className="text-orange-400 font-bold">{customPropsRotation}°</span>
                  </div>
                  <input
                    id="propRotSlider"
                    type="range"
                    min="0"
                    max="360"
                    step="5"
                    value={customPropsRotation}
                    onChange={(e) => handleCustomPropsRotationChange(parseInt(e.target.value))}
                    className="w-full accent-orange-500 bg-white/10 h-1 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Collapsible Precision Callibration Subsections */}
              <div className="pt-2 border-t border-white/5 space-y-2">
                <button
                  id="advancedToggleBtn"
                  onClick={() => setShowAdvancedCalibration(!showAdvancedCalibration)}
                  className="w-full flex items-center justify-between text-[10px] font-mono font-bold text-orange-400 uppercase tracking-widest hover:text-orange-200 transition-colors cursor-pointer text-left"
                >
                  <span className="flex items-center space-x-1">
                    <Sparkles className="w-3 h-3 text-orange-400 animate-pulse" />
                    <span>{showAdvancedCalibration ? "HIDE ADVANCED RIG OFFSETS" : "SHOW ADVANCED RIG OFFSETS"}</span>
                  </span>
                  <span className="text-[9px] text-[#d1d1d6]/50 font-bold bg-white/5 px-1.5 py-0.5 rounded">
                    {showAdvancedCalibration ? "CLOSE" : "EXPAND"}
                  </span>
                </button>

                {showAdvancedCalibration && (
                  <div className="space-y-4 pt-2.5 animate-fadeIn font-mono text-[9px] text-[#d1d1d6]/80 leading-relaxed border-t border-white/5">
                    
                    {/* Pivot Coordinate Shifts */}
                    <div className="space-y-2">
                      <span className="text-[9px] font-bold text-orange-400 block uppercase border-b border-white/5 pb-0.5">
                        BLOCKBENCH ENTRANCE PIVOT SHIFTS
                      </span>
                      
                      <div>
                        <div className="flex justify-between">
                          <span>PIVOT OFFSET X (CHEST SHIFT):</span>
                          <span className="text-[#d1d1d6] font-bold">{chassisOffsetX.toFixed(2)} units</span>
                        </div>
                        <input
                          id="pivotXSlider"
                          type="range"
                          min="-2.0"
                          max="2.0"
                          step="0.05"
                          value={chassisOffsetX}
                          onChange={(e) => setChassisOffsetX(parseFloat(e.target.value))}
                          className="w-full accent-orange-500 bg-white/10 h-1 rounded cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between">
                          <span>PIVOT OFFSET Y (HEIGHT ADJUST):</span>
                          <span className="text-[#d1d1d6] font-bold">{chassisOffsetY.toFixed(2)} units</span>
                        </div>
                        <input
                          id="pivotYSlider"
                          type="range"
                          min="-2.0"
                          max="2.0"
                          step="0.05"
                          value={chassisOffsetY}
                          onChange={(e) => setChassisOffsetY(parseFloat(e.target.value))}
                          className="w-full accent-orange-500 bg-white/10 h-1 rounded cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between">
                          <span>PIVOT OFFSET Z (DEPTH ALIGN):</span>
                          <span className="text-[#d1d1d6] font-bold">{chassisOffsetZ.toFixed(2)} units</span>
                        </div>
                        <input
                          id="pivotZSlider"
                          type="range"
                          min="-2.0"
                          max="2.0"
                          step="0.05"
                          value={chassisOffsetZ}
                          onChange={(e) => setChassisOffsetZ(parseFloat(e.target.value))}
                          className="w-full accent-orange-500 bg-white/10 h-1 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Firing Nozzle Adjustments */}
                    <div className="space-y-2">
                      <span className="text-[9px] font-bold text-orange-400 block uppercase border-b border-white/5 pb-0.5">
                        WEAPON FIRE POINT COORDINATES
                      </span>

                      <div>
                        <div className="flex justify-between">
                          <span>BARREL WIDTH EXPANSION (X):</span>
                          <span className="text-[#d1d1d6] font-bold">{muzzleOffsetX.toFixed(2)} (width offset)</span>
                        </div>
                        <input
                          id="muzzleXSlider"
                          type="range"
                          min="-2.0"
                          max="3.0"
                          step="0.05"
                          value={muzzleOffsetX}
                          onChange={(e) => setMuzzleOffsetX(parseFloat(e.target.value))}
                          className="w-full accent-orange-500 bg-white/10 h-1 rounded cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between">
                          <span>BARREL HEIGHT DISPLACEMENT (Y):</span>
                          <span className="text-[#d1d1d6] font-bold">{muzzleOffsetY.toFixed(2)} (height offset)</span>
                        </div>
                        <input
                          id="muzzleYSlider"
                          type="range"
                          min="-2.0"
                          max="3.0"
                          step="0.05"
                          value={muzzleOffsetY}
                          onChange={(e) => setMuzzleOffsetY(parseFloat(e.target.value))}
                          className="w-full accent-orange-500 bg-white/10 h-1 rounded cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between">
                          <span>BARREL NOZZLE PROJECTION (Z):</span>
                          <span className="text-[#d1d1d6] font-bold">{muzzleOffsetZ.toFixed(2)} (outfield projection)</span>
                        </div>
                        <input
                          id="muzzleZSlider"
                          type="range"
                          min="-1.5"
                          max="4.0"
                          step="0.05"
                          value={muzzleOffsetZ}
                          onChange={(e) => setMuzzleOffsetZ(parseFloat(e.target.value))}
                          className="w-full accent-orange-500 bg-white/10 h-1 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Floating Bobbing Wave and Speed */}
                    <div className="space-y-2">
                      <span className="text-[9px] font-bold text-orange-400 block uppercase border-b border-white/5 pb-0.5">
                        LIVE PULSE ANIMATIONS & MOTION TILT
                      </span>

                      <div>
                        <div className="flex justify-between">
                          <span>BOBBING AMPLITUDE (Y-HEIGHT CHOP):</span>
                          <span className="text-[#d1d1d6] font-bold">{bobbingHeight.toFixed(3)} units</span>
                        </div>
                        <input
                          id="bobHeightSlider"
                          type="range"
                          min="0.0"
                          max="0.5"
                          step="0.01"
                          value={bobbingHeight}
                          onChange={(e) => setBobbingHeight(parseFloat(e.target.value))}
                          className="w-full accent-orange-500 bg-white/10 h-1 rounded cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between">
                          <span>BOBBING ENGINE SPIN SPEED:</span>
                          <span className="text-[#d1d1d6] font-bold">{bobbingSpeed.toFixed(2)}x rate</span>
                        </div>
                        <input
                          id="bobSpeedSlider"
                          type="range"
                          min="0.0"
                          max="4.0"
                          step="0.1"
                          value={bobbingSpeed}
                          onChange={(e) => setBobbingSpeed(parseFloat(e.target.value))}
                          className="w-full accent-orange-500 bg-white/10 h-1 rounded cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between">
                          <span>WALK PITCH TILT BIAS:</span>
                          <span className="text-[#d1d1d6] font-bold">{tiltPitch.toFixed(2)} pitch rads</span>
                        </div>
                        <input
                          id="tiltPitchSlider"
                          type="range"
                          min="0.0"
                          max="0.6"
                          step="0.02"
                          value={tiltPitch}
                          onChange={(e) => setTiltPitch(parseFloat(e.target.value))}
                          className="w-full accent-orange-500 bg-white/10 h-1 rounded cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between">
                          <span>SIDE-SWAY WALKING SWING (ROLL):</span>
                          <span className="text-[#d1d1d6] font-bold">{swayRoll.toFixed(3)} sway rads</span>
                        </div>
                        <input
                          id="swayRollSlider"
                          type="range"
                          min="0.0"
                          max="0.2"
                          step="0.01"
                          value={swayRoll}
                          onChange={(e) => setSwayRoll(parseFloat(e.target.value))}
                          className="w-full accent-orange-500 bg-white/10 h-1 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Capsule Boundaries */}
                    <div className="space-y-2">
                      <span className="text-[9px] font-bold text-orange-400 block uppercase border-b border-white/5 pb-0.5">
                        RIG PHYSICAL SLIDDING COLLISION
                      </span>

                      <div>
                        <div className="flex justify-between">
                          <span>RIG HITBOX RADIUS COEF:</span>
                          <span className="text-[#d1d1d6] font-bold">{collisionRadius.toFixed(2)} radius units</span>
                        </div>
                        <input
                          id="colRadiusSlider"
                          type="range"
                          min="0.1"
                          max="2.5"
                          step="0.05"
                          value={collisionRadius}
                          onChange={(e) => setCollisionRadius(parseFloat(e.target.value))}
                          className="w-full accent-orange-500 bg-white/10 h-1 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                  </div>
                )}
              </div>
            </div>

            {/* Custom Modular Asset Library */}
            {libraryItems.length > 0 && (
              <div className="border border-orange-500/20 rounded bg-orange-500/5 p-2.5 space-y-3">
                <div className="flex items-center space-x-1.5 border-b border-orange-500/10 pb-1">
                  <Layers className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-[10px] font-mono font-bold tracking-widest text-orange-400 uppercase">
                    GLB Asset Library (Kit)
                  </span>
                </div>
                
                <p className="text-[9px] text-[#d1d1d6]/60 leading-normal font-mono">
                  Discovered <strong className="text-orange-400">{libraryItems.length}</strong> modules. Select one, then click the grid to place copies!
                </p>

                {/* Extracted items checklist */}
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {libraryItems.map((item) => {
                    const isSelected = selectedLibraryItem === item.id;
                    return (
                      <button
                        key={item.id}
                        id={`library_item_${item.id}`}
                        onClick={() => setSelectedLibraryItem(item.id)}
                        className={`w-full text-left font-mono text-[10px] p-1.5 rounded border transition-all cursor-pointer truncate ${
                          isSelected
                            ? "bg-orange-500/20 border-orange-500 text-white font-bold"
                            : "bg-black/40 border-white/5 text-[#d1d1d6] hover:bg-black/60 hover:text-white"
                        }`}
                      >
                        {isSelected ? "👉 " : "◻️ "}
                        {item.name}
                      </button>
                    );
                  })}
                </div>

                {/* Placement togglers & Auto Arrangement */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
                  <button
                    id="togglePlacementModeButton"
                    onClick={() => setPlacementMode(!placementMode)}
                    className={`p-1.5 rounded text-[10px] font-mono border font-bold transition-all cursor-pointer ${
                      placementMode
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 animate-pulse"
                        : "bg-black/40 border-white/5 text-white/50 hover:text-[#d1d1d6]"
                    }`}
                  >
                    {placementMode ? "🟢 ON-GRID ON" : "🔴 PLACING OFF"}
                  </button>

                  <button
                    id="autoArrangeLayoutButton"
                    onClick={handleAutoArrange}
                    className="p-1.5 rounded text-[10px] font-mono border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 hover:text-white transition-all cursor-pointer font-bold text-center uppercase tracking-wide"
                  >
                    ⚡ Auto Layout
                  </button>
                </div>
              </div>
            )}

            {/* Slider configuration filters: Isometric view parameters */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center space-x-1 pb-1 border-b border-white/5">
                <Camera className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-[10px] font-bold tracking-widest text-[#d1d1d6] uppercase">Camera Projections</span>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-mono text-[#d1d1d6] mb-1">
                  <span>CAMERA ZOOM DIST:</span>
                  <span className="text-orange-400 font-bold">{cameraDist}m</span>
                </div>
                <input
                  id="cameraZoomSlider"
                  type="range"
                  min="15"
                  max="60"
                  value={cameraDist}
                  onChange={(e) => handleCameraDistChange(parseInt(e.target.value))}
                  className="w-full accent-orange-500 bg-white/10 h-1 rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-mono text-[#d1d1d6] mb-1">
                  <span>VIEWS FIELD OF VIEW (FOV):</span>
                  <span className="text-orange-400 font-bold">{fov.toFixed(2)} rad</span>
                </div>
                <input
                  id="cameraFovSlider"
                  type="range"
                  min="0.15"
                  max="0.65"
                  step="0.02"
                  value={fov}
                  onChange={(e) => handleFovChange(parseFloat(e.target.value))}
                  className="w-full accent-orange-500 bg-white/10 h-1 rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-mono text-[#d1d1d6] mb-1">
                  <span>CAMERA HEAD-PITCH OFFSET:</span>
                  <span className="text-orange-400 font-bold">{pitch}° / 90°</span>
                </div>
                <input
                  id="cameraPitchSlider"
                  type="range"
                  min="20"
                  max="70"
                  value={pitch}
                  onChange={(e) => handlePitchChange(parseInt(e.target.value))}
                  className="w-full accent-orange-500 bg-white/10 h-1 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "effects" && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-1 pb-1 border-b border-white/5">
                <Sun className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-[10px] font-bold tracking-widest text-[#d1d1d6] uppercase">Bloom & Glow Shaders</span>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-mono text-[#d1d1d6] mb-1">
                  <span>EMISSIVE GLOW INTENSITY:</span>
                  <span className="text-orange-400 font-bold">{(glowIntensity * 100).toFixed(0)}%</span>
                </div>
                <input
                  id="emissiveGlowSlider"
                  type="range"
                  min="0"
                  max="2.5"
                  step="0.1"
                  value={glowIntensity}
                  onChange={(e) => handleGlowIntensityChange(parseFloat(e.target.value))}
                  className="w-full accent-orange-500 bg-white/10 h-1 rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-mono text-[#d1d1d6] mb-1">
                  <span>LENS BLOOM WEIGHT:</span>
                  <span className="text-orange-400 font-bold">{bloomWeight.toFixed(2)}</span>
                </div>
                <input
                  id="lensBloomSlider"
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={bloomWeight}
                  onChange={(e) => handleBloomWeightChange(parseFloat(e.target.value))}
                  className="w-full accent-orange-500 bg-white/10 h-1 rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-mono text-[#d1d1d6] mb-1">
                  <span>FILMIC EXPOSURE LEVEL:</span>
                  <span className="text-orange-400 font-bold">{exposure.toFixed(2)}</span>
                </div>
                <input
                  id="filmicExposureSlider"
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={exposure}
                  onChange={(e) => handleExposureChange(parseFloat(e.target.value))}
                  className="w-full accent-orange-500 bg-white/10 h-1 rounded cursor-pointer"
                />
              </div>

              <div className="pt-2">
                <button
                  id="onScreenJoystickToggle"
                  onClick={() => setShowJoystick(!showJoystick)}
                  className="w-full p-2 rounded text-xs font-mono border border-white/5 hover:border-orange-500/30 bg-black/40 hover:bg-black/60 text-[#d1d1d6] flex items-center justify-between cursor-pointer transition-all"
                >
                  <span>MOBILE JOYSTICK HUD</span>
                  <span className={showJoystick ? "text-green-400 font-bold" : "text-white/30"}>
                    {showJoystick ? "● VISIBLE" : "○ HIDDEN"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "help" && (
          <div className="space-y-3 text-[11px] font-mono leading-relaxed text-[#d1d1d6]/70">
            <p className="font-sans text-xs text-white font-bold mb-1 border-b border-white/5 pb-1 tracking-wider uppercase">
              KEYBOARD BRIEFINGS
            </p>
            <div className="grid grid-cols-2 gap-y-1.5">
              <span>W A S D / Arrows:</span>
              <span className="text-orange-400 font-bold">Move Mech Unit</span>
              
              <span>MOUSE MOVE:</span>
              <span className="text-orange-400">Aim Weapon Arms</span>

              <span>LEFT CLICK:</span>
              <span className="text-orange-400">Fire standard laser</span>

              <span>SPACE BAR:</span>
              <span className="text-orange-400 font-bold">Thrust Dash</span>

              <span>Q key / "1":</span>
              <span className="text-rose-400 font-bold">Heavy plasma beam</span>

              <span>E key / "2":</span>
              <span className="text-amber-400 font-bold">Orbital mortar</span>
            </div>

            <div className="mt-4 pt-2 border-t border-white/5">
              <span className="text-[10px] text-white/40 font-bold block mb-1 tracking-widest">VERTICAL SANDBOX TARGET</span>
              <p className="text-[10px] tracking-wide text-white/30">
                Test movement response rates, camera reading elevations, and particle performance loops before matchmaking matches.
              </p>
            </div>
          </div>
        )}

        {activeTab === "json" && (
          <SandboxConfigPanel
            theme={theme}
            glowIntensity={glowIntensity}
            bloomWeight={bloomWeight}
            exposure={exposure}
            fov={fov}
            cameraDist={cameraDist}
            pitch={pitch}
            customChassisScale={customChassisScale}
            customChassisRotation={customChassisRotation}
            customPropsScale={customPropsScale}
            customPropsRotation={customPropsRotation}
            chassisOffsetX={chassisOffsetX}
            chassisOffsetY={chassisOffsetY}
            chassisOffsetZ={chassisOffsetZ}
            muzzleOffsetX={muzzleOffsetX}
            muzzleOffsetY={muzzleOffsetY}
            muzzleOffsetZ={muzzleOffsetZ}
            bobbingHeight={bobbingHeight}
            bobbingSpeed={bobbingSpeed}
            tiltPitch={tiltPitch}
            swayRoll={swayRoll}
            collisionRadius={collisionRadius}
            gameManagerRef={gameManagerRef}
            handleThemeChange={handleThemeChange}
            handleGlowIntensityChange={handleGlowIntensityChange}
            handleBloomWeightChange={handleBloomWeightChange}
            handleExposureChange={handleExposureChange}
            handleFovChange={handleFovChange}
            handleCameraDistChange={handleCameraDistChange}
            handlePitchChange={handlePitchChange}
            handleCustomChassisScaleChange={handleCustomChassisScaleChange}
            handleCustomChassisRotationChange={handleCustomChassisRotationChange}
            handleCustomPropsScaleChange={handleCustomPropsScaleChange}
            handleCustomPropsRotationChange={handleCustomPropsRotationChange}
            handleChassisOffsetXChange={setChassisOffsetX}
            handleChassisOffsetYChange={setChassisOffsetY}
            handleChassisOffsetZChange={setChassisOffsetZ}
            handleMuzzleOffsetXChange={setMuzzleOffsetX}
            handleMuzzleOffsetYChange={setMuzzleOffsetY}
            handleMuzzleOffsetZChange={setMuzzleOffsetZ}
            handleBobbingHeightChange={setBobbingHeight}
            handleBobbingSpeedChange={setBobbingSpeed}
            handleTiltPitchChange={setTiltPitch}
            handleSwayRollChange={setSwayRoll}
            handleCollisionRadiusChange={setCollisionRadius}
          />
        )}

        {/* Custom drag load status panels */}
        {customAssets.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-orange-400 uppercase tracking-widest">Loaded Sandbox Imports</span>
              <button
                id="clearImportsButton"
                onClick={handleClearAssets}
                className="text-[10px] font-mono text-rose-400 hover:text-rose-200 flex items-center space-x-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>RESTORE FACTORY</span>
              </button>
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {customAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center justify-between bg-black/60 p-1.5 rounded text-[10px] font-mono border border-white/5"
                >
                  <span className="text-[#d1d1d6] truncate w-[170px]">{asset.name}</span>
                  <span className="text-orange-500 italic">[{asset.type}]</span>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>
      )}

      {/* Cyberpunk corner cosmetic ornaments */}
      <div className="absolute top-4 right-4 pointer-events-none text-[9px] font-mono text-slate-600 hidden lg:block z-3">
        SEC: DECK_STABILIZED // NO_DRIFT // REGISTRY: BK-77
      </div>

      {showFXWorkbench && (
        <FXWorkbenchPanel
          gameManagerRef={gameManagerRef}
          onClose={() => setShowFXWorkbench(false)}
        />
      )}
    </div>
  );
}
