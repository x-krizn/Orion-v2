/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Vector3, Matrix } from "@babylonjs/core";
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
  ChevronDown,
  ChevronUp,
  Download,
  Lock,
  Unlock,
  Settings,
  Shield,
  Heart,
  Move,
  Target,
} from "lucide-react";
import { GameManager } from "./game/game/GameManager";
import { PerformanceStats, ModelAssetInfo } from "./game/types";
import { SandboxConfigPanel } from "./components/SandboxConfigPanel";
import { FXWorkbenchPanel } from "./components/FXWorkbenchPanel";
// @ts-ignore
import menuBackgroundUrl from "./assets/images/menu_background_1780583746459.png";

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

  // Navigation / Game state: "menu" | "training" | "editor" | "options"
  // Defaulting to "menu" on load to support GitHub Pages and custom game states starting cleanly.
  const [gameState, setGameState] = useState<"menu" | "training" | "editor" | "options">("menu");

  // App mode is now a derived constant computed from the game state
  const appMode = gameState === "editor" ? "edit" : "play";

  // Custom keyword query input state
  const [showEditorAuth, setShowEditorAuth] = useState<boolean>(false);
  const [authKeyword, setAuthKeyword] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);

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
  const [showCombatDebug, setShowCombatDebug] = useState<boolean>(true);
  const [commanderCollapsed, setCommanderCollapsed] = useState<boolean>(false);
  const [showFXWorkbench, setShowFXWorkbench] = useState<boolean>(false);

  // Souls inspired Layout states
  const [layoutUnlocked, setLayoutUnlocked] = useState<boolean>(false);

  useEffect(() => {
    setLayoutUnlocked(appMode === "edit");
  }, [appMode]);
  const [joystickOffset, setJoystickOffset] = useState({ x: 0, y: 0 });
  const [actionsOffset, setActionsOffset] = useState({ x: 0, y: 0 });
  const [joystickSize, setJoystickSize] = useState<number>(1.0);
  const [actionsSize, setActionsSize] = useState<number>(1.0);
  const [selectedTheme, setSelectedTheme] = useState<string>("cyber");

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
  const joystickPointerIdRef = useRef<number | null>(null);
  const [isDraggingJoystick, setIsDraggingJoystick] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || gameState === "menu" || gameState === "options") {
      gameManagerRef.current = null;
      return;
    }

    // Instantiate game coordinator with optional large arena for training
    const arenaSizeOverride = gameState === "training" ? 150 : undefined;

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
      },
      arenaSizeOverride
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
      gameManagerRef.current = null;
      window.removeEventListener("keydown", blockKeys);
    };
  }, [gameState]);

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

  // ----------------------------------------------------
  // Dynamic Real-time HUD projection & Resource Update Tick
  // ----------------------------------------------------
  useEffect(() => {
    let frameId: number;
    const updateTick = () => {
      const gm = gameManagerRef.current;
      if (gm && gm.player && gm.scene && gm.scene.activeCamera) {
        const player = gm.player;
        const playerPos = player.getPosition();
        
        // A. Process player resource bars (HP, EN, Heat, Armor) across all active HUD layout modes
        const updateFillAndText = (fillId: string, textId: string, ratio: number, textString: string, activeClassName?: string) => {
          const fillEl = document.getElementById(fillId);
          const textEl = document.getElementById(textId);
          if (fillEl) {
            fillEl.style.width = `${Math.max(0, Math.min(1.0, ratio)) * 100}%`;
            if (activeClassName) {
              fillEl.className = activeClassName;
            }
          }
          if (textEl) textEl.innerText = textString;
        };

        const hpRatio = player.hp / player.maxHp;
        const hpStr = `HP: ${Math.ceil(player.hp)} / ${player.maxHp}`;
        updateFillAndText("topHudHpFill", "topHudHpText", hpRatio, hpStr);
        updateFillAndText("deckHudHpFill", "deckHudHpText", hpRatio, hpStr);
        updateFillAndText("mobileHpFill", "mobileHpText", hpRatio, hpStr);

        const armorRatio = player.armor / player.maxArmor;
        const armorStr = `ARMOR: ${Math.ceil(player.armor)} / ${player.maxArmor}`;
        updateFillAndText("topHudArmorFill", "topHudArmorText", armorRatio, armorStr);
        updateFillAndText("deckHudArmorFill", "deckHudArmorText", armorRatio, armorStr);

        const enRatio = player.en / player.maxEn;
        const enStr = `EN: ${Math.ceil(player.en)} / ${player.maxEn}`;
        updateFillAndText("topHudEnFill", "topHudEnText", enRatio, enStr);
        updateFillAndText("deckHudEnFill", "deckHudEnText", enRatio, enStr);
        updateFillAndText("mobileEnFill", "mobileEnText", enRatio, enStr);

        const heatRatio = player.heat / player.maxHeat;
        const heatStr = player.isOverheated ? "OVERHEAT" : `HEAT: ${Math.ceil(player.heat)}%`;
        const heatClass = player.isOverheated
          ? "h-full bg-red-650 animate-pulse transition-all duration-75 relative"
          : "h-full bg-orange-500 transition-all duration-75 relative";
        
        updateFillAndText("topHudHeatFill", "topHudHeatText", heatRatio, heatStr, heatClass);
        updateFillAndText("deckHudHeatFill", "deckHudHeatText", heatRatio, heatStr, heatClass);
        updateFillAndText("mobileHeatFill", "mobileHeatText", heatRatio, heatStr, heatClass);

        // C. Update Combat Debug HUD elements
        const updateDebugEl = (elId: string, text: string) => {
          const el = document.getElementById(elId);
          if (el) el.innerText = text;
        };
        const updateDebugAttr = (elId: string, classNameStr: string) => {
          const el = document.getElementById(elId);
          if (el) el.className = classNameStr;
        };

        const cs = player.combatState;
        if (cs) {
          updateDebugEl("dbgHp", `${Math.ceil(cs.hp)} / ${cs.maxHp}`);
          updateDebugEl("dbgArmor", `${Math.ceil(cs.armor)} / ${cs.maxArmor} ${cs.isArmorBroken ? '(BRK: ' + cs.armorBreakTimer.toFixed(1) + 's)' : ''}`);
          updateDebugAttr("dbgArmor", cs.isArmorBroken ? "text-rose-500 font-bold animate-pulse text-[10.5px]" : "text-sky-300 text-[10.5px] font-black");

          updateDebugEl("dbgEn", `${Math.ceil(cs.en)} / ${cs.maxEn}`);
          updateDebugEl("dbgHeat", `${Math.ceil(cs.heat)}% ${cs.isOverheated ? '(OHT: ' + cs.overheatCooldownTimer.toFixed(1) + 's)' : ''}`);
          updateDebugAttr("dbgHeat", cs.isOverheated ? "text-rose-500 font-bold animate-pulse text-[10.5px]" : "text-orange-400 text-[10.5px] font-black");

          updateDebugEl("dbgLock", `${cs.lockState} ${cs.lockState === 'Acquiring' ? '(' + (cs.lockProgress * 100).toFixed(0) + '%)' : ''}`);
          updateDebugEl("dbgLockTarget", cs.lockTargetId ? cs.lockTargetId : "None");

          updateDebugEl("dbgActionState", cs.actionState);
          updateDebugAttr("dbgActionState", cs.actionState === 'Interrupted' ? "text-rose-500 font-black animate-bounce" : "text-emerald-400 font-black");
          updateDebugEl("dbgActiveAction", cs.currentAction ? `${cs.currentAction.name} (${cs.actionPhaseTimer.toFixed(1)}s)` : "None");

          updateDebugEl("dbgPoise", `${Math.ceil(cs.poise)} / ${cs.maxPoise}`);
          updateDebugEl("dbgStagger", `${Math.ceil(cs.staggerAccumulation)} / ${cs.staggerThreshold}`);
          
          updateDebugEl("dbgGuard", `${Math.ceil(cs.guardIntegrity)} / ${cs.maxGuardIntegrity} ${cs.isGuardBroken ? '(BROKEN: ' + cs.guardBreakTimer.toFixed(1) + 's)' : ''}`);
          updateDebugAttr("dbgGuard", cs.isGuardBroken ? "text-rose-500 font-bold animate-pulse" : "text-yellow-300 font-black");
        }
        
        // B. Mobile floating HUD projection near player
        const mobileHud = document.getElementById("mobilePlayerFloatingHUD");
        if (mobileHud) {
          const engine = gm.scene.getEngine();
          const offsetPos = playerPos.clone();
          offsetPos.y += 2.2; // float offset
          
          const projected = Vector3.Project(
            offsetPos,
            Matrix.IdentityReadOnly,
            gm.scene.getTransformMatrix(),
            gm.scene.activeCamera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
          );
          
          mobileHud.style.left = `${projected.x}px`;
          mobileHud.style.top = `${projected.y}px`;
          mobileHud.style.transform = "translate(-50%, -100%)";
          
          const mHp = document.getElementById("mobileHpFill");
          const mEn = document.getElementById("mobileEnFill");
          const mHeat = document.getElementById("mobileHeatFill");
          
          if (mHp) mHp.style.width = `${Math.max(0, Math.min(1.0, player.hp / player.maxHp)) * 100}%`;
          if (mEn) mEn.style.width = `${Math.max(0, Math.min(1.0, player.en / player.maxEn)) * 100}%`;
          if (mHeat) {
            mHeat.style.width = `${Math.max(0, Math.min(1.0, player.heat / player.maxHeat)) * 100}%`;
            mHeat.className = player.isOverheated ? "h-1 bg-red-500 animate-pulse-fast" : "h-1 bg-orange-400";
          }
        }
        
        // C. Generate coordinate projection markers (Target Brackets & Offscreen warnings)
        const lockContainer = document.getElementById("hudLockTargetsLayer");
        if (lockContainer) {
          let hudHTML = "";
          const engine = gm.scene.getEngine();
          const canvas = engine.getRenderingCanvas();
          const clientW = canvas ? canvas.clientWidth : engine.getRenderWidth();
          const clientH = canvas ? canvas.clientHeight : engine.getRenderHeight();
          const viewportGlobal = gm.scene.activeCamera.viewport.toGlobal(clientW, clientH);
          
          const maxW = clientW;
          const maxH = clientH;

          gm.spawnedEnemies.forEach(enemy => {
            const enemyScale = enemy.data?.scale || 1.0;
            const enemyPos = enemy.node.position.clone();
            enemyPos.y += 0.8 * enemyScale;

            const projected = Vector3.Project(
              enemyPos,
              Matrix.IdentityReadOnly,
              gm.scene.getTransformMatrix(),
              viewportGlobal
            );

            const inFront = projected.z > 0 && projected.z < 1.0;
            const onScreen = projected.x >= 0 && projected.x <= maxW && projected.y >= 0 && projected.y <= maxH;

            if (!onScreen || !inFront) {
              // Off-screen threat direction math
              const vectorX = projected.x - maxW / 2;
              const vectorY = projected.y - maxH / 2;
              const angle = Math.atan2(vectorY, vectorX);
              const margin = 60;
              const arrowX = Math.max(margin, Math.min(maxW - margin, maxW / 2 + Math.cos(angle) * (maxW / 2 - margin)));
              const arrowY = Math.max(margin, Math.min(maxH - margin, maxH / 2 + Math.sin(angle) * (maxH / 2 - margin)));
              const dist = Vector3.Distance(playerPos, enemyPos);
              
              hudHTML += `
                <div class="absolute text-red-500 font-mono text-[9px] pointer-events-none flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2" style="left: ${arrowX}px; top: ${arrowY}px; text-shadow: 0 0 4px rgba(0,0,0,0.85);">
                  <span class="animate-bounce font-bold">⚠️</span>
                  <span class="text-[8px] bg-slate-900/90 text-red-400 font-bold px-1 border border-red-500/20 rounded">${dist.toFixed(0)}m</span>
                </div>
              `;
            } else {
              // On screen locking brackets
              const dist = Vector3.Distance(playerPos, enemyPos);
              const isLocked = gm.lockedTargets.find(lt => lt.enemy === enemy);
              const progress = isLocked ? isLocked.progress : 0;
              const fullyLocked = isLocked && progress >= 1.0;

              const borderCol = fullyLocked 
                ? "border-red-500/95 text-red-500 drop-shadow-[0_0_4px_rgba(239,68,68,0.5)]" 
                : (isLocked ? "border-yellow-500/80 text-yellow-400" : "border-slate-500/30 text-slate-400/60");
                
              const size = fullyLocked ? "w-16 h-16 scale-110" : "w-14 h-14 animate-pulse";
              
              const tag = fullyLocked 
                ? `<span class="bg-red-900/90 text-white border border-red-500 text-[8px] px-1 font-bold rounded uppercase">LOCKED</span>` 
                : (isLocked 
                  ? `<span class="bg-yellow-900/85 text-yellow-300 border border-yellow-500/30 text-[7px] px-1 rounded">LOCKING ${(progress * 100).toFixed(0)}%</span>` 
                  : `<span class="bg-slate-900/65 text-slate-400 text-[7px] px-1 rounded">DETECTED</span>`);

              hudHTML += `
                <div class="absolute pointer-events-none flex flex-col items-center -translate-x-1/2 -translate-y-1/2 transition-transform duration-75" style="left: ${projected.x}px; top: ${projected.y}px;">
                  <div class="${size} border-2 border-dashed ${borderCol} rounded relative flex items-center justify-center">
                    <span class="text-[7px] tracking-tight font-mono absolute -top-4 px-1 bg-[#121217]/90 text-slate-300 rounded border border-white/5 opacity-80">${enemy.data.name}</span>
                    <span class="text-[9px] font-mono leading-none tracking-wider font-bold">${dist.toFixed(0)}m</span>
                    ${fullyLocked ? `<span class="absolute -bottom-4 text-[7px] text-red-400 font-extrabold tracking-tighter bg-black/80 px-1 rounded border border-red-500/20">HP ${Math.ceil(enemy.health)}</span>` : ''}
                  </div>
                  <div class="mt-1 flex gap-1 items-center justify-center">${tag}</div>
                </div>
              `;
            }
          });
          lockContainer.innerHTML = hudHTML;
        }
      }
      frameId = requestAnimationFrame(updateTick);
    };
    frameId = requestAnimationFrame(updateTick);
    return () => cancelAnimationFrame(frameId);
  }, []);

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

  const handleAuthSubmit = () => {
    if (authKeyword.trim().toLowerCase() === "brakes") {
      setGameState("editor");
      setShowEditorAuth(false);
      setAuthKeyword("");
      setAuthError(null);
    } else {
      setAuthError("QUANTUM KEY UNRECOGNIZED");
    }
  };

  const handleSpawnEnemy = (enemyId: string) => {
    const gm = gameManagerRef.current;
    if (!gm || !gm.player) return;

    const transformNode = gm.player.getRootNode();
    const forward = transformNode.forward;
    const playerPos = gm.player.getPosition();

    // Spawn 12 meters in front of the player along their forward vector with minor offset spread
    const spawnPos = playerPos.add(forward.scale(12));
    spawnPos.x += (Math.random() - 0.5) * 4;
    spawnPos.z += (Math.random() - 0.5) * 4;
    spawnPos.y = 0;

    gm.spawnEnemyAt(enemyId, spawnPos);
    gm.fx.spawnExplosion(spawnPos, 8, 0.6);
  };

  const handleClearEnemies = () => {
    const gm = gameManagerRef.current;
    if (!gm) return;

    gm.spawnedEnemies.forEach((e) => {
      e.node.dispose();
    });
    gm.spawnedEnemies = [];
    gm.lockedTargets = [];

    // Trigger explosive area-cleared shockwave
    if (gm.player) {
      const pPos = gm.player.getPosition();
      gm.fx.spawnExplosion(pPos, 20, 1.2);
    }
  };

  const handleExitToMenu = () => {
    setGameState("menu");
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
  // Draggable HUD & Layout drag logic
  // ----------------------------------------------------
  const [activeDragTarget, setActiveDragTarget] = useState<"joystick" | "actions" | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialOffsetRef = useRef({ x: 0, y: 0 });

  const handleDragStart = (target: "joystick" | "actions", e: React.MouseEvent | React.TouchEvent) => {
    if (!layoutUnlocked) return;
    e.stopPropagation();
    setActiveDragTarget(target);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    dragStartRef.current = { x: clientX, y: clientY };
    initialOffsetRef.current = target === "joystick" ? { ...joystickOffset } : { ...actionsOffset };
  };

  const handleDragMoveRelative = (e: React.MouseEvent | React.TouchEvent) => {
    if (!activeDragTarget) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    
    if (activeDragTarget === "joystick") {
      setJoystickOffset({
        x: initialOffsetRef.current.x + dx,
        y: initialOffsetRef.current.y - dy // y screen is inverted from bottom
      });
    } else if (activeDragTarget === "actions") {
      setActionsOffset({
        x: initialOffsetRef.current.x - dx, // right-aligned invert
        y: initialOffsetRef.current.y - dy
      });
    }
  };

  const handleDragEndRelative = () => {
    setActiveDragTarget(null);
  };

  // ----------------------------------------------------
  // Virtual Joysticks drag logic (using Pointer Events for flawless multitouch)
  // ----------------------------------------------------
  const handleJoystickPointerDown = (e: React.PointerEvent) => {
    if (layoutUnlocked) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLDivElement;
    target.setPointerCapture(e.pointerId);
    joystickPointerIdRef.current = e.pointerId;
    setIsDraggingJoystick(true);
    updateJoystickPos(e);
  };

  const handleJoystickPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingJoystick || e.pointerId !== joystickPointerIdRef.current) return;
    updateJoystickPos(e);
  };

  const handleJoystickPointerUpOrCancel = (e: React.PointerEvent) => {
    if (e.pointerId !== joystickPointerIdRef.current) return;
    releaseJoystick();
  };

  const releaseJoystick = () => {
    setIsDraggingJoystick(false);
    joystickPointerIdRef.current = null;
    if (joystickKnobRef.current) {
      joystickKnobRef.current.style.transform = `translate(0px, 0px)`;
    }
    gameManagerRef.current?.input.handleJoystickUpdate(0, 0, false);
  };

  const updateJoystickPos = (e: React.PointerEvent) => {
    if (!joystickBoundRef.current || !joystickKnobRef.current) return;

    const boundRect = joystickBoundRef.current.getBoundingClientRect();
    const boundCenterX = boundRect.left + boundRect.width / 2;
    const boundCenterY = boundRect.top + boundRect.height / 2;

    const clientX = e.clientX;
    const clientY = e.clientY;

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

  // Helper to bind gameplay action buttons to work flawlessly with multi-touch and mouse clicks simultaneously
  const bindInputButton = (actionFn: () => void) => {
    return {
      onPointerDown: (e: React.PointerEvent) => {
        if (layoutUnlocked) return;
        e.preventDefault();
        e.stopPropagation();
        actionFn();
      },
      onTouchStart: (e: React.TouchEvent) => {
        if (layoutUnlocked) return;
        e.preventDefault();
        e.stopPropagation();
        actionFn();
      },
    };
  };

  const simulateKey = (key: string, isDown: boolean) => {
    const event = new KeyboardEvent(isDown ? "keydown" : "keyup", {
      key: key,
      code: key === " " ? "Space" : `Key${key.toUpperCase()}`,
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(event);
  };

  return (
    <div 
      className="relative w-full h-full select-none overflow-hidden bg-[#0a0a0c] text-[#d1d1d6] font-sans" 
      id="appRoot"
      onMouseMove={handleDragMoveRelative}
      onMouseUp={handleDragEndRelative}
      onTouchMove={handleDragMoveRelative}
      onTouchEnd={handleDragEndRelative}
    >
      
      {/* 3D Render Canvas */}
      <canvas
        id="renderCanvas"
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block touch-none z-0"
      />

      {/* High-Performance 3D Coordinates Projected Target Tracking Layer */}
      <div id="hudLockTargetsLayer" className="absolute inset-0 pointer-events-none z-2 overflow-hidden" />

      {/* Dynamic 3D Projected Mobile Player Status Gauge */}
      <div 
        id="mobilePlayerFloatingHUD" 
        className="absolute hidden pointer-events-none z-3 select-none w-32 bg-slate-900/85 backdrop-blur border border-white/10 rounded p-1.5 flex flex-col space-y-1 shadow-2xl shadow-black/80 font-mono"
      >
        <div className="flex justify-between items-center text-[8px] font-bold leading-none text-red-500 mb-0.5">
          <span>HP</span>
        </div>
        <div className="w-full bg-black/60 rounded-sm h-[3px] overflow-hidden">
          <div id="mobileHpFill" className="h-full bg-red-500 transition-all duration-75" style={{ width: '100%' }} />
        </div>

        <div className="flex justify-between items-center text-[8px] font-bold leading-none text-emerald-400 mb-0.5 mt-0.5">
          <span>EN</span>
        </div>
        <div className="w-full bg-black/60 rounded-sm h-[3px] overflow-hidden">
          <div id="mobileEnFill" className="h-full bg-emerald-400 transition-all duration-75" style={{ width: '100%' }} />
        </div>

        <div className="flex justify-between items-center text-[8px] font-bold leading-none text-orange-400 mb-0.5 mt-0.5">
          <span>HEAT</span>
        </div>
        <div className="w-full bg-black/60 rounded-sm h-[3px] overflow-hidden">
          <div id="mobileHeatFill" className="h-full bg-orange-400 transition-all duration-75" style={{ width: '100%' }} />
        </div>
      </div>

      {/* Grid Scanline aesthetics overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_50%,rgba(0,0,0,0.6)_100%)] z-1" />

      {/* Cybernetic HUD overlay: Header Title info */}
      <header className="absolute top-4 left-4 z-4 flex items-center justify-between pointer-events-none w-[calc(100%-2rem)]">
        {appMode === "edit" ? (
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
                <button
                  onClick={handleExitToMenu}
                  className="pointer-events-auto px-2 py-0.5 bg-red-500/20 hover:bg-red-500/35 border border-red-500 text-rose-350 hover:text-white text-[9px] rounded font-mono font-bold uppercase transition-all flex items-center gap-1 cursor-pointer"
                  title="Quit to Main Menu"
                >
                  <span>Quit Area</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="pointer-events-auto flex flex-wrap items-center gap-3 md:gap-4 cyber-panel py-1.5 px-3 rounded-md border-white/10 bg-[#0a0a0d]/92 backdrop-blur-md shadow-lg">
            {/* Collapsed Build version info */}
            <div className="flex flex-col border-r border-white/10 pr-3">
              <span className="text-[7px] font-mono text-slate-500 font-bold tracking-wider leading-none uppercase">SYSTEM READY</span>
              <span className="text-[9px] font-mono font-black text-orange-500 tracking-wide mt-1">BUILD v2.4-STABLE</span>
            </div>

            {/* Quick Diagnostics Toggle */}
            <button
              id="telemetryToggleButton"
              onClick={() => setShowTelemetry(!showTelemetry)}
              className="px-1.5 py-0.5 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-slate-300 hover:text-white text-[8px] rounded font-mono uppercase transition-all flex items-center gap-1 cursor-pointer"
              title="Toggle Diagnostic Overlay"
            >
              <Activity className="w-2 h-2 animate-pulse text-orange-400" />
              <span>DIAG: {showTelemetry ? "ON" : "OFF"}</span>
            </button>

            {/* Combat Debug Toggle */}
            <button
              id="combatDebugToggleButton"
              onClick={() => setShowCombatDebug(!showCombatDebug)}
              className="px-1.5 py-0.5 bg-rose-500/11 hover:bg-rose-500/25 border border-rose-500/35 text-slate-300 hover:text-white text-[8px] rounded font-mono uppercase transition-all flex items-center gap-1 cursor-pointer"
              title="Toggle Combat Debug Overlay"
            >
              <Cpu className="w-2 h-2 animate-pulse text-rose-450" />
              <span>COMBAT DBG: {showCombatDebug ? "ON" : "OFF"}</span>
            </button>

            {gameState === "training" && (
              <button
                onClick={handleExitToMenu}
                className="px-1.5 py-0.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-rose-350 hover:text-white text-[8px] rounded font-mono uppercase transition-all flex items-center gap-1 cursor-pointer"
                title="Exit Training mode and return to main menu"
              >
                <span>Quit Area</span>
              </button>
            )}

            {/* HP HUD progress bar */}
            <div className="flex flex-col w-20 leading-none">
              <div className="flex justify-between items-center text-[8px] font-bold text-red-500 mb-0.5">
                <span className="flex items-center gap-0.5"><Heart className="w-2 h-2" /> HP</span>
                <span id="topHudHpText" className="text-[8px] text-red-400">HP: --/--</span>
              </div>
              <div className="w-full bg-slate-800 rounded-sm h-[4px] overflow-hidden border border-black/20">
                <div id="topHudHpFill" className="h-full bg-red-600 w-full transition-all duration-75 relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                </div>
              </div>
            </div>

            {/* Shield Armor resistance progress bar */}
            <div className="flex flex-col w-20 leading-none">
              <div className="flex justify-between items-center text-[8px] font-bold text-sky-450 mb-0.5">
                <span className="flex items-center gap-0.5"><Shield className="w-2 h-2" /> AM</span>
                <span id="topHudArmorText" className="text-[8px] text-sky-300">ARMOR: --/--</span>
              </div>
              <div className="w-full bg-slate-800 rounded-sm h-[4px] overflow-hidden border border-black/20">
                <div id="topHudArmorFill" className="h-full bg-sky-500 w-full transition-[#a1e2fc] duration-75 relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                </div>
              </div>
            </div>

            {/* EN Stamina battery progress bar */}
            <div className="flex flex-col w-20 leading-none">
              <div className="flex justify-between items-center text-[8px] font-bold text-emerald-450 mb-0.5">
                <span className="flex items-center gap-0.5"><Zap className="w-2 h-2" /> EN</span>
                <span id="topHudEnText" className="text-[8px] text-emerald-300">EN: --</span>
              </div>
              <div className="w-full bg-slate-800 rounded-sm h-[4px] overflow-hidden border border-black/20">
                <div id="topHudEnFill" className="h-full bg-emerald-505 w-full transition-[#66ffb3] duration-75 relative" />
              </div>
            </div>

            {/* Thermals Heat progress bar */}
            <div className="flex flex-col w-16 leading-none">
              <div className="flex justify-between items-center text-[8px] font-bold text-orange-450 mb-0.5">
                <span className="flex items-center gap-0.5"><Crosshair className="w-2 h-2" /> HEAT</span>
                <span id="topHudHeatText" className="text-[8px] text-orange-300">HEAT: --%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-sm h-[4px] overflow-hidden border border-black/20">
                <div id="topHudHeatFill" className="h-full bg-orange-500 w-full transition-all duration-75" />
              </div>
            </div>
          </div>
        )}

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
      </header>      {/* ---------------------------------------------------- */}
      {/* COMBAT FLIGHT DECKS (Two Corner-Anchored Flight Suites) */}
      {/* ---------------------------------------------------- */}
      {showJoystick && (
        <>
          {/* LEFT WING DECK (Walk/Aim Analog Stick, X Y A Face Buttons & System Controls) */}
          <div 
            onPointerDown={(e) => { if (!layoutUnlocked) { e.stopPropagation(); } }}
            onTouchStart={(e) => { if (!layoutUnlocked) { e.stopPropagation(); } }}
            onTouchMove={(e) => { if (!layoutUnlocked) { e.stopPropagation(); } }}
            onTouchEnd={(e) => { if (!layoutUnlocked) { e.stopPropagation(); } }}
            className={`absolute z-4 select-none pointer-events-auto rounded-2xl p-3 sm:p-4 border transition-all ${
              layoutUnlocked 
                ? "border-red-500 bg-red-950/30 shadow-[0_0_20px_rgba(239,68,68,0.3)] ring-2 ring-red-500/40" 
                : "border-zinc-850 bg-[#07070a]/94 backdrop-blur-md shadow-[0_0_25px_rgba(0,0,0,0.92)]"
            }`}
            style={{
              left: '1.5rem',
              bottom: '1.5rem',
              transform: `translate(${joystickOffset.x}px, -${joystickOffset.y}px) scale(${joystickSize})`,
              transformOrigin: 'bottom left',
              touchAction: 'none',
              width: '320px'
            }}
          >
            {layoutUnlocked && (
              <div 
                onMouseDown={(e) => handleDragStart("joystick", e)}
                onTouchStart={(e) => handleDragStart("joystick", e)}
                className="absolute -top-6 left-0 right-0 h-5 bg-red-500 text-black text-[9px] font-mono font-black flex items-center justify-between px-2 cursor-move rounded-t-md uppercase select-none animate-pulse"
              >
                <div className="flex items-center gap-1">
                  <Move className="w-2.5 h-2.5" />
                  <span>Drag Left Deck</span>
                </div>
                <div className="flex gap-1.5 pointer-events-auto" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
                  <button 
                    onClick={() => setJoystickSize(Math.max(0.6, joystickSize - 0.1))} 
                    className="bg-black/40 hover:bg-black/60 text-white w-3 h-3 flex items-center justify-center rounded font-bold text-[8px] cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-[8px] font-bold">{(joystickSize * 100).toFixed(0)}%</span>
                  <button 
                    onClick={() => setJoystickSize(Math.min(1.8, joystickSize + 0.1))} 
                    className="bg-black/40 hover:bg-black/60 text-white w-3 h-3 flex items-center justify-center rounded font-bold text-[8px] cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Left Deck layout: Row structure holding Analog Stick, select/start, and XY/A face buttons */}
            <div className="flex items-center justify-between mt-1">
              
              {/* 1. Touch Analog Control Stick */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] text-zinc-500 font-bold mb-1.5 uppercase tracking-widest text-[#8e8e93]">ANALOG STICK</span>
                <div
                  ref={joystickBoundRef}
                  onPointerDown={handleJoystickPointerDown}
                  onPointerMove={handleJoystickPointerMove}
                  onPointerUp={handleJoystickPointerUpOrCancel}
                  onPointerCancel={handleJoystickPointerUpOrCancel}
                  className="relative w-20 h-20 rounded-full bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-center shadow-inner touch-none cursor-pointer"
                >
                  {/* Subtle crosshairs / details */}
                  <div className="absolute inset-2 rounded-full border border-zinc-800/20 pointer-events-none" />
                  <div className="absolute top-1/2 left-1 right-1 h-[1px] bg-zinc-800/20 pointer-events-none" />
                  <div className="absolute left-1/2 top-1 bottom-1 w-[1px] bg-zinc-800/20 pointer-events-none" />
                  
                  <div
                    ref={joystickKnobRef}
                    className="w-9 h-9 rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-650 border border-zinc-600 shadow-[0_4px_10px_rgba(0,0,0,0.6)] flex items-center justify-center pointer-events-none transition-transform duration-75"
                    style={{ transform: "translate(0px, 0px)" }}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-zinc-950/40 border border-zinc-800" />
                  </div>
                </div>
              </div>

              {/* 2. Middle Row: Start & Select (Sel) rubber pill buttons */}
              <div className="flex flex-col items-center justify-center px-1">
                <span className="text-[7px] text-zinc-500 font-bold mb-1.5 uppercase tracking-widest text-[#8e8e93]">SYSTEM</span>
                <div className="flex flex-col space-y-2 items-center bg-[#0d0d12] border border-zinc-900/60 p-2.5 rounded-lg shadow-inner">
                  {/* SEL Button */}
                  <button
                    onClick={() => setShowTelemetry(!showTelemetry)}
                    className={`w-9 h-4 rounded-full border shadow transition-all cursor-pointer active:scale-90 flex items-center justify-center ${
                      showTelemetry
                        ? "bg-cyan-500/20 border-cyan-400 text-cyan-400 font-bold"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400"
                    }`}
                    title="Toggle Telemetry Diagnostics"
                  >
                    <span className="text-[6px] font-black uppercase tracking-tighter">SEL</span>
                  </button>
                  {/* START Button */}
                  <button
                    {...bindInputButton(() => gameManagerRef.current?.triggerStanceSwap())}
                    className="w-9 h-4 rounded-full bg-red-950/40 hover:bg-red-900/30 border border-red-500/50 text-red-400 shadow active:scale-90 flex items-center justify-center transition-all cursor-pointer"
                    title="Weapon/Matrix Stance Swap"
                  >
                    <span className="text-[6px] font-black uppercase tracking-tighter text-rose-450">START</span>
                  </button>
                </div>
              </div>

              {/* 3. Face Action Buttons (X Y A Cluster Arrangement) */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] text-zinc-500 font-bold mb-1.5 uppercase tracking-widest text-[#8e8e93]">ACTION</span>
                <div className="relative w-20 h-20 bg-zinc-950/60 border border-zinc-800/80 rounded-full select-none shadow-inner flex items-center justify-center">
                  
                  {/* Y Button: Top center */}
                  <button
                    {...bindInputButton(() => gameManagerRef.current?.triggerStanceSwap())}
                    className="absolute top-1 w-6 h-6 rounded-full bg-[#181822] hover:bg-yellow-500/20 border border-yellow-500/40 hover:border-yellow-400 text-yellow-550 font-bold text-[9px] flex items-center justify-center active:scale-90 transition-all cursor-pointer shadow"
                    title="Stance Swap (Y)"
                  >
                    Y
                  </button>

                  {/* X Button: Left side */}
                  <button
                    {...bindInputButton(() => gameManagerRef.current?.triggerActionCancel())}
                    className="absolute left-1 w-6 h-6 rounded-full bg-[#181822] hover:bg-blue-500/20 border border-blue-500/40 hover:border-blue-400 text-blue-400 font-bold text-[9px] flex items-center justify-center active:scale-90 transition-all cursor-pointer shadow"
                    title="Clear / Interrupt Locks (X)"
                  >
                    X
                  </button>

                  {/* A Button: Bottom center */}
                  <button
                    {...bindInputButton(() => gameManagerRef.current?.triggerContextAction())}
                    className="absolute bottom-1 w-6 h-6 rounded-full bg-[#181822] hover:bg-emerald-500/20 border border-emerald-500/40 hover:border-emerald-400 text-emerald-450 font-bold text-[9px] flex items-center justify-center active:scale-90 transition-all cursor-pointer shadow"
                    title="Shockwave context trigger (A)"
                  >
                    A
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* RIGHT WING DECK (Triggers: L1, L2, R1, R2, Dash B Booster) */}
          <div 
            onPointerDown={(e) => { if (!layoutUnlocked) { e.stopPropagation(); } }}
            onTouchStart={(e) => { if (!layoutUnlocked) { e.stopPropagation(); } }}
            onTouchMove={(e) => { if (!layoutUnlocked) { e.stopPropagation(); } }}
            onTouchEnd={(e) => { if (!layoutUnlocked) { e.stopPropagation(); } }}
            className={`absolute z-4 select-none pointer-events-auto rounded-2xl p-3 sm:p-4 border transition-all ${
              layoutUnlocked 
                ? "border-red-500 bg-red-950/30 shadow-[0_0_20px_rgba(239,68,68,0.3)] ring-2 ring-red-500/40" 
                : "border-zinc-850 bg-[#07070a]/94 backdrop-blur-md shadow-[0_0_25px_rgba(0,0,0,0.92)]"
            }`}
            style={{
              right: '1.5rem',
              bottom: '1.5rem',
              transform: `translate(-${actionsOffset.x}px, -${actionsOffset.y}px) scale(${actionsSize})`,
              transformOrigin: 'bottom right',
              touchAction: 'none',
              width: '270px'
            }}
          >
            {layoutUnlocked && (
              <div 
                onMouseDown={(e) => handleDragStart("actions", e)}
                onTouchStart={(e) => handleDragStart("actions", e)}
                className="absolute -top-6 left-0 right-0 h-5 bg-red-500 text-black text-[9px] font-mono font-black flex items-center justify-between px-2 cursor-move rounded-t-md uppercase select-none animate-pulse"
              >
                <div className="flex items-center gap-1">
                  <Move className="w-2.5 h-2.5" />
                  <span>Drag Right Deck</span>
                </div>
                <div className="flex gap-1.5 pointer-events-auto" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
                  <button 
                    onClick={() => setActionsSize(Math.max(0.6, actionsSize - 0.1))} 
                    className="bg-black/40 hover:bg-black/60 text-white w-3 h-3 flex items-center justify-center rounded font-bold text-[8px] cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-[8px] font-bold">{(actionsSize * 100).toFixed(0)}%</span>
                  <button 
                    onClick={() => setActionsSize(Math.min(1.8, actionsSize + 0.1))} 
                    className="bg-black/40 hover:bg-black/60 text-white w-3 h-3 flex items-center justify-center rounded font-bold text-[8px] cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Right Deck layout: Double wings of triggers flanking a larger physical red circle B Dash button */}
            <div className="flex flex-col items-center">
              <span className="text-[7px] text-zinc-500 font-bold mb-2.5 uppercase tracking-widest text-[#8e8e93] leading-none">COMBAT & DRIFT TRIGGER MODULE</span>
              
              <div className="w-full flex items-center justify-between mt-1 px-1">
                
                {/* Left side: Off-hand Shoulder Bumpers (L1/L2) */}
                <div className="flex flex-col space-y-2">
                  {/* L2 trigger (Rail/Vortex) */}
                  <button
                    {...bindInputButton(() => gameManagerRef.current?.triggerL2_OffSecondary())}
                    className="flex flex-col items-center justify-center h-10 w-11 bg-[#1a1a24]/80 hover:bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded-lg hover:text-white transition-all cursor-pointer shadow active:scale-95"
                    title="Vortex Rail Cannon (L2)"
                  >
                    <span className="text-[9px] font-black text-white">L2</span>
                    <span className="text-[5px] font-bold text-cyan-400 uppercase leading-none mt-0.5">RAIL</span>
                  </button>

                  {/* L1 trigger (Shield/Parry) */}
                  <button
                    {...bindInputButton(() => gameManagerRef.current?.triggerL1_OffPrimary())}
                    className="flex flex-col items-center justify-center h-10 w-11 bg-[#1a1a24]/80 hover:bg-slate-500/10 border border-zinc-700 text-[#d1d1d6] rounded-lg hover:text-white transition-all cursor-pointer shadow active:scale-95"
                    title="Shield Parry Defend (L1)"
                  >
                    <span className="text-[9px] font-black text-slate-300">L1</span>
                    <span className="text-[5px] font-bold text-slate-400 uppercase leading-none mt-0.5">SHLD</span>
                  </button>
                </div>

                {/* Center: Large Kinetic red B Booster button */}
                <div className="flex flex-col items-center">
                  <button
                    {...bindInputButton(() => gameManagerRef.current?.triggerButtonDash())}
                    className="w-14 h-14 rounded-full bg-gradient-to-tr from-red-650 to-rose-500 hover:from-red-500 hover:to-rose-400 border-2 border-red-400 shadow-[0_0_18px_rgba(239,68,68,0.55)] flex flex-col items-center justify-center active:scale-95 text-white cursor-pointer transition-transform duration-75 shadow-md"
                    title="Thruster Dash drive (B)"
                  >
                    <span className="text-sm font-black drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] leading-none mb-0.5">B</span>
                    <span className="text-[5.5px] font-extrabold tracking-widest opacity-95 drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)] leading-none text-red-100 uppercase scale-90">BOOST</span>
                  </button>
                </div>

                {/* Right side: Main Weapon Shoulder Bumpers (R1/R2) */}
                <div className="flex flex-col space-y-2">
                  {/* R2 trigger (Mortar/Wave) */}
                  <button
                    {...bindInputButton(() => gameManagerRef.current?.triggerR2_Secondary())}
                    className="flex flex-col items-center justify-center h-10 w-11 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-550/40 text-rose-350 rounded-lg hover:text-white transition-all cursor-pointer shadow active:scale-95"
                    title="Secondary Heavy Mortar (R2)"
                  >
                    <span className="text-[9px] font-black text-rose-400">R2</span>
                    <span className="text-[5px] font-bold text-rose-500 uppercase leading-none mt-0.5">MRTR</span>
                  </button>

                  {/* R1 trigger (Pulse/Slash) */}
                  <button
                    {...bindInputButton(() => gameManagerRef.current?.triggerR1_Primary())}
                    className="flex flex-col items-center justify-center h-10 w-11 bg-orange-950/20 hover:bg-orange-950/40 border border-orange-550/40 text-orange-350 rounded-lg hover:text-white transition-all cursor-pointer shadow active:scale-95 animate-pulse-slow"
                    title="Primary Laser Slash (R1)"
                  >
                    <span className="text-[9px] font-black text-orange-400">R1</span>
                    <span className="text-[5px] font-bold text-orange-500 uppercase leading-none mt-0.5">PULSE</span>
                  </button>
                </div>

              </div>
            </div>
          </div>
        </>
      )}
        {/* Centered Desktop Resource dashboard (visible on desktop screen ranges in edit mode) */}
      {appMode === "edit" && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-3 pointer-events-auto select-none bg-black/75 backdrop-blur-md rounded-lg border border-white/15 p-2 px-3.5 flex flex-col space-y-1.5 w-72 shadow-2xl shadow-black max-md:hidden font-mono">
          <div className="flex items-center justify-between border-b border-white/5 pb-1">
            <div className="flex gap-1.5 items-center">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-[9px] font-black text-slate-300 uppercase letter-wider">Mech Combat Suite</span>
            </div>
            <span className="text-[8px] text-slate-500">[Souls HUD Edition]</span>
          </div>

          {/* HP */}
          <div className="flex flex-col space-y-0.5">
            <div className="flex justify-between items-center text-[8px] leading-none text-red-500">
              <span className="flex items-center gap-1 font-bold"><Heart className="w-2.5 h-2.5" /> HP INDEX</span>
              <span id="deckHudHpText" className="font-bold text-red-400 text-[9px]">HP: -- / --</span>
            </div>
            <div className="w-full bg-slate-800/80 rounded-sm h-[6px] overflow-hidden border border-black/20">
              <div id="deckHudHpFill" className="h-full bg-red-600 w-full transition-all duration-75 relative">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
              </div>
            </div>
          </div>

          {/* Armor shield */}
          <div className="flex flex-col space-y-0.5">
            <div className="flex justify-between items-center text-[8px] leading-none text-sky-400">
              <span className="flex items-center gap-1 font-bold"><Shield className="w-2.5 h-2.5" /> AM RESISTANCE</span>
              <span id="deckHudArmorText" className="font-bold text-sky-300 text-[9px]">ARMOR: -- / --</span>
            </div>
            <div className="w-full bg-slate-800/80 rounded-sm h-[6px] overflow-hidden border border-black/20">
              <div id="deckHudArmorFill" className="h-full bg-sky-500 w-full transition-[#a1e2fc] duration-75 relative">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
              </div>
            </div>
          </div>

          {/* Energy stamina */}
          <div className="flex flex-col space-y-0.5">
            <div className="flex justify-between items-center text-[8px] leading-none text-emerald-400">
              <span className="flex items-center gap-1 font-bold"><Zap className="w-2.5 h-2.5" /> EN ENERGIZER</span>
              <span id="deckHudEnText" className="font-bold text-emerald-300 text-[9px]">EN: --</span>
            </div>
            <div className="w-full bg-slate-800/80 rounded-sm h-[5px] overflow-hidden border border-black/20">
              <div id="deckHudEnFill" className="h-full bg-emerald-500 w-full transition-[#66ffb3] duration-75 relative" />
            </div>
          </div>

          {/* Heat thermal level */}
          <div className="flex flex-col space-y-0.5">
            <div className="flex justify-between items-center text-[8px] leading-none text-orange-400">
              <span className="flex items-center gap-1 font-bold"><Crosshair className="w-2.5 h-2.5" /> HEAT OVERLOAD</span>
              <span id="deckHudHeatText" className="font-bold text-orange-300 text-[9px]">HEAT: --%</span>
            </div>
            <div className="w-full bg-slate-850/80 rounded-sm h-[5px] overflow-hidden border border-black/20">
              <div id="deckHudHeatFill" className="h-full bg-orange-500 w-full transition-all duration-75" />
            </div>
          </div>
        </div>
      )}

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

      {/* TRAINING COMMAND FLIGHT DECK */}
      {gameState === "training" && (
        <div className={`absolute top-24 left-4 z-4 select-none pointer-events-auto w-64 p-4 border border-zinc-800 bg-[#0c0c11]/92 backdrop-blur-md rounded-lg shadow-2xl font-mono text-[11px] flex flex-col ${commanderCollapsed ? "" : "space-y-3"}`}>
          <div className={`flex items-center justify-between ${commanderCollapsed ? "" : "border-b border-zinc-850 pb-2 mb-1"}`}>
            <button
              onClick={() => setCommanderCollapsed(!commanderCollapsed)}
              className="flex items-center space-x-1.5 hover:text-cyan-200 cursor-pointer focus:outline-none text-left transition-all"
              title={commanderCollapsed ? "Expand Training Commander" : "Collapse Training Commander"}
            >
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-ping flex-shrink-0" />
              <span className="text-cyan-400 font-bold uppercase tracking-widest text-xs">TRAINING COMMANDER</span>
              {commanderCollapsed ? (
                <ChevronDown className="w-3.5 h-3.5 text-cyan-400/70" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5 text-cyan-400/70" />
              )}
            </button>
            <button
              onClick={handleExitToMenu}
              className="text-[9px] text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 px-1.5 py-0.5 rounded cursor-pointer transition-all uppercase font-semibold flex-shrink-0"
            >
              Quit
            </button>
          </div>

          {!commanderCollapsed && (
            <>
              <p className="text-[10px] text-[#d1d1d6]/60 leading-normal uppercase">
                SPAWN PRACTICE FRACTION UNITS INTO ARMORED ARENA AT RANGE 12M:
              </p>

              <div className="flex flex-col space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                {enemies.length > 0 ? (
                  enemies.map((enemy) => (
                    <button
                      key={enemy.id}
                      onClick={() => handleSpawnEnemy(enemy.id)}
                      className="w-full text-left p-2 rounded bg-cyan-950/20 hover:bg-cyan-950/35 border border-cyan-500/20 hover:border-cyan-500/50 text-[#d1d1d6] hover:text-cyan-200 flex items-center justify-between tracking-wide transition-all cursor-pointer font-bold uppercase text-[9px]"
                    >
                      <span>{enemy.name}</span>
                      <span className="text-cyan-400">SPAWN</span>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-[10px] text-[#d1d1d6]/40 uppercase tracking-tight">
                    No dynamic test frames loaded
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-zinc-850 space-y-1.5">
                <button
                  onClick={handleClearEnemies}
                  className="w-full p-2 bg-red-950/25 border border-red-500/20 hover:border-red-500/50 text-red-400 hover:text-red-200 rounded text-center transition-all cursor-pointer text-[10px] font-bold uppercase"
                >
                  💥 Purge Active Hostiles
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* COMBAT SYSTEM HUD DEBUG TERMINAL */}
      {gameState === "training" && showCombatDebug && (
        <div className="absolute right-4 top-20 z-40 w-72 bg-[#040407]/92 border border-orange-500/30 rounded-xl p-4 font-mono select-none pointer-events-auto backdrop-blur-md shadow-[0_0_25px_rgba(249,115,22,0.15)] flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-orange-500/20 pb-2">
            <span className="text-[10px] font-black tracking-widest text-[#d1d1d6]/50 uppercase flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
              ORION COMBAT CORE
            </span>
            <button 
              onClick={() => setShowCombatDebug(false)}
              className="text-[#d1d1d6]/40 hover:text-white text-[9px] hover:bg-orange-500/10 px-1 border border-transparent hover:border-orange-500/10 rounded cursor-pointer"
            >
              [X]
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[9px] uppercase font-bold text-[#d1d1d6]/70">
            <div className="flex flex-col border border-white/5 bg-white/[0.01] p-1.5 rounded">
              <span className="text-red-400 text-[8px] tracking-wider mb-1 flex items-center gap-1"><Heart className="w-1.5 h-1.5"/> CORE REPLICATOR</span>
              <span id="dbgHp" className="text-[10.5px] font-black text-rose-350">-- / --</span>
            </div>
            <div className="flex flex-col border border-white/5 bg-white/[0.01] p-1.5 rounded">
              <span className="text-sky-450 text-[8px] tracking-wider mb-1 flex items-center gap-1"><Shield className="w-1.5 h-1.5"/> ARMOR BARRIER</span>
              <span id="dbgArmor" className="text-[10.5px] font-black text-sky-300">-- / --</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[9px] uppercase font-bold text-[#d1d1d6]/70">
            <div className="flex flex-col border border-white/5 bg-white/[0.01] p-1.5 rounded">
              <span className="text-emerald-400 text-[8px] tracking-wider mb-1 flex items-center gap-1"><Zap className="w-1.5 h-1.5"/> EN CHARGE</span>
              <span id="dbgEn" className="text-[10.5px] font-black text-emerald-300">-- / --</span>
            </div>
            <div className="flex flex-col border border-white/5 bg-white/[0.01] p-1.5 rounded">
              <span className="text-orange-400 text-[8px] tracking-wider mb-1 flex items-center gap-1"><Crosshair className="w-1.5 h-1.5"/> THERMAL RES.</span>
              <span id="dbgHeat" className="text-[10.5px] font-black text-orange-300">--%</span>
            </div>
          </div>

          <div className="border-t border-white/5 pt-2 flex flex-col space-y-1.5 text-[9px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 uppercase tracking-wide">TARGET ACQUISITION:</span>
              <span id="dbgLock" className="font-bold text-orange-400">---</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 uppercase tracking-wide">LOCKED SCANNER:</span>
              <span id="dbgLockTarget" className="font-mono text-cyan-400 max-w-[130px] truncate text-right">---</span>
            </div>
          </div>

          <div className="border-t border-white/5 pt-2 flex flex-col space-y-1.5 text-[9px]">
            <div className="flex justify-between items-center bg-zinc-950/40 p-1 rounded">
              <span className="text-slate-400 uppercase">ACTION FLOW:</span>
              <span id="dbgActionState" className="font-black">Neutral</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 uppercase">ACTIVE MOUNT:</span>
              <span id="dbgActiveAction" className="font-mono text-cyan-200 text-right overflow-hidden max-w-[150px] truncate">None</span>
            </div>
          </div>

          <div className="border-t border-white/5 pt-2 grid grid-cols-2 gap-2 text-[9px]">
            <div className="flex flex-col">
              <span className="text-purple-400 text-[8px] tracking-wide mb-0.5 font-bold">POISE GAP</span>
              <span id="dbgPoise" className="font-bold text-purple-300">100 / 100</span>
            </div>
            <div className="flex flex-col">
              <span className="text-amber-400 text-[8px] tracking-wide mb-0.5 font-bold">STAGGER RATE</span>
              <span id="dbgStagger" className="font-bold text-amber-300">0 / 60</span>
            </div>
          </div>

          <div className="border-t border-white/5 pt-2 flex justify-between items-center text-[9px]">
            <span className="text-slate-400 uppercase font-bold"><Shield className="inline w-3 h-3 text-yellow-400 mr-0.5" /> AEGIS INTEGRITY:</span>
            <span id="dbgGuard" className="font-black text-yellow-300">200 / 200</span>
          </div>
        </div>
      )}

      {/* CORE RETRO CYBERPUNK MAIN MENU OVERLAY */}
      {gameState === "menu" && (
        <div 
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#07070c] overflow-hidden select-none"
          style={{
            backgroundImage: `radial-gradient(circle at center, rgba(0,0,0,0.1) 30%, rgba(7,7,12,0.92) 85%), url(${menuBackgroundUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Scanline CRT simulation */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_50%,rgba(0,0,0,0.7)_100%)] mix-blend-overlay opacity-80" />
          <div className="absolute inset-0 pointer-events-none bg-repeat opacity-15" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='105%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90.5deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] opacity-35 animate-pulse" />

          {/* Center-aligned columns container */}
          <div className="w-full max-w-5xl px-8 flex flex-col md:grid md:grid-cols-12 gap-8 items-center justify-center py-6">
            
            {/* Left Wing: Game Description and Retro-Neon Branding */}
            <div className="md:col-span-7 flex flex-col items-start space-y-5 text-left">
              <div className="relative group flex flex-col">
                <span className="absolute -top-5 left-0 text-[9px] font-mono tracking-[0.3em] text-cyan-400 uppercase font-black animate-pulse">
                  NEO-BABYLON INDUSTRIAL CO.
                </span>
                <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none select-none flex flex-col pt-1">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.45)]">
                    PROJECT
                  </span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-rose-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]">
                    ORION
                  </span>
                </h1>
                <div className="absolute -bottom-2 w-32 h-[2px] bg-gradient-to-r from-rose-500 to-orange-500" />
                <div className="absolute -bottom-2 w-8 h-[4px] bg-rose-500" />
              </div>

              <p className="max-w-md text-[10px] font-mono text-[#d1d1d6]/60 leading-normal uppercase tracking-wider pt-3">
                TACTICAL HARDPOINT SIMULATOR // REG_SYS_v1.0.8<br />
                PELORUS PILOT MECH SYSTEM ENG_STABLE.<br />
                WEAPON LOADOUT INTEGRITY REPLICATOR... ACTIVE.
              </p>
            </div>

            {/* Right Wing: Selections Array */}
            <div className="md:col-span-12 md:max-w-none lg:col-span-5 flex flex-col items-stretch justify-center w-full max-w-sm space-y-2.5 bg-black/55 hover:bg-black/65 px-6 py-7 rounded-xl border border-white/5 backdrop-blur-md transition-all">
              
              <div className="text-[9px] font-mono text-[#d1d1d6]/40 uppercase tracking-[0.22em] mb-2 text-center border-b border-white/5 pb-2">
                SYSTEM MODULE DESIGNS
              </div>

              {/* NEW GAME */}
              <button
                disabled
                className="group relative flex items-center justify-between p-2.5 rounded border border-white/5 bg-white/[0.01] opacity-35 text-white/30 cursor-not-allowed uppercase font-mono text-xs tracking-widest text-left"
              >
                <span className="font-bold flex items-center space-x-2">
                  <span>New</span>
                </span>
                <span className="text-[8px] px-1.5 py-0.5 border border-red-500/25 text-red-500/60 font-medium rounded bg-red-950/20">
                  DISABLED
                </span>
              </button>

              {/* LOAD GAME */}
              <button
                disabled
                className="group relative flex items-center justify-between p-2.5 rounded border border-white/5 bg-white/[0.01] opacity-35 text-white/30 cursor-not-allowed uppercase font-mono text-xs tracking-widest text-left"
              >
                <span className="font-bold flex items-center space-x-2">
                  <span>Load</span>
                </span>
                <span className="text-[8px] px-1.5 py-0.5 border border-red-500/25 text-red-500/60 font-medium rounded bg-red-950/20">
                  DISABLED
                </span>
              </button>

              {/* TRAINING (Neon Blue/Cyan) */}
              <button
                onClick={() => {
                  setGameState("training");
                }}
                className="group relative flex items-center justify-between p-3 rounded border border-cyan-500/40 hover:border-cyan-400 bg-cyan-950/25 hover:bg-cyan-950/45 text-cyan-200 hover:text-white uppercase font-mono text-xs tracking-widest text-left cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.15)] hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all"
              >
                <span className="font-bold flex items-center space-x-2">
                  <span className="text-cyan-400 group-hover:translate-x-1 transition-transform">▶</span>
                  <span className="tracking-widest">Training Mode</span>
                </span>
                <span className="text-[8px] px-1.5 py-0.5 border border-cyan-500/35 text-cyan-400 font-black rounded bg-cyan-950/40">
                  SELECTED
                </span>
              </button>

              {/* EDITOR (Orange/Amber with verification code) */}
              <button
                onClick={() => {
                  setShowEditorAuth(true);
                  setAuthError(null);
                  setAuthKeyword("");
                }}
                className="group relative flex items-center justify-between p-3 rounded border border-orange-500/40 hover:border-orange-400 bg-orange-950/25 hover:bg-orange-950/45 text-orange-200 hover:text-white uppercase font-mono text-xs tracking-widest text-left cursor-pointer shadow-[0_0_12px_rgba(249,115,22,0.15)] hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all"
              >
                <span className="font-bold flex items-center space-x-2">
                  <span className="text-orange-400 group-hover:translate-x-1 transition-transform">⚙</span>
                  <span className="tracking-widest">Editor Mode</span>
                </span>
                <span className="text-[8px] px-1.5 py-0.5 border border-orange-500/35 text-orange-400 font-bold rounded bg-orange-950/40">
                  SELECTABLE
                </span>
              </button>

              {/* GITHUB REPOSITORY */}
              <button
                onClick={() => {
                  window.open("https://github.com/x-krizn/Orion-v2", "_blank");
                }}
                className="group relative flex items-center justify-between p-3 rounded border border-indigo-500/40 hover:border-indigo-400 bg-indigo-950/25 hover:bg-indigo-950/45 text-indigo-400 hover:text-white uppercase font-mono text-xs tracking-widest text-left cursor-pointer shadow-[0_0_12px_rgba(99,102,241,0.15)] hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all"
              >
                <span className="font-bold flex items-center space-x-2">
                  <span className="text-indigo-400 group-hover:translate-x-1 transition-transform">ℹ</span>
                  <span className="tracking-widest">GitHub Repository</span>
                </span>
                <span className="text-[8px] px-1.5 py-0.5 border border-indigo-500/35 text-indigo-400 font-bold rounded bg-indigo-950/40">
                  LAUNCH
                </span>
              </button>
            </div>
          </div>

          {/* Code word auth modal */}
          {showEditorAuth && (
            <div className="absolute inset-0 z-50 bg-[#040406]/92 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="flex flex-col space-y-4 p-6 bg-[#0c0c11] border-2 border-orange-500/60 rounded-xl shadow-[0_0_40px_rgba(249,115,22,0.3)] w-full max-w-sm text-center animate-fade-in font-mono border-double">
                <div className="flex items-center justify-center space-x-1.5 text-orange-400">
                  <span className="text-sm animate-pulse">✦</span>
                  <h3 className="text-xs font-bold uppercase tracking-[0.25em]">DEC_KEY AUTHORIZATION</h3>
                  <span className="text-sm animate-pulse">✦</span>
                </div>
                
                <p className="text-[9px] text-white/50 leading-relaxed uppercase">
                  CONFIRM QUANTUM KEYWORD DECRYPT KEY TO OVERRIDE SANDBOX SUITE INTEGRATION:
                </p>

                <div className="space-y-1.5">
                  <input
                    type="password"
                    placeholder="ENTER CODE WORD"
                    value={authKeyword}
                    onChange={(e) => {
                      setAuthKeyword(e.target.value);
                      setAuthError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAuthSubmit();
                    }}
                    className="w-full bg-black/90 text-orange-400 placeholder-orange-950 border border-orange-500/50 rounded p-2 text-center text-xs tracking-[0.25em] font-bold focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 transition-all font-mono uppercase"
                    autoFocus
                  />
                  {authError && (
                    <div className="text-rose-500 text-[9px] uppercase font-bold tracking-wider bg-rose-950/20 border border-rose-500/30 py-1 rounded animate-pulse">
                      {authError}
                    </div>
                  )}
                </div>

                <div className="flex space-x-3 pt-1">
                  <button
                    onClick={() => {
                      setShowEditorAuth(false);
                      setAuthKeyword("");
                      setAuthError(null);
                    }}
                    className="w-1/2 p-2 text-[10px] font-bold border border-white/10 hover:border-white/30 text-white/40 hover:text-white uppercase rounded cursor-pointer transition-all rounded-md"
                  >
                    Abort
                  </button>
                  <button
                    onClick={handleAuthSubmit}
                    className="w-1/2 p-2 text-[10px] bg-orange-600 hover:bg-orange-500 text-black border border-orange-500 uppercase rounded cursor-pointer transition-all font-bold rounded-md shadow-md shadow-orange-600/10"
                  >
                    Authorize
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
