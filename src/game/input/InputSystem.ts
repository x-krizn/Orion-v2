/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Vector3 } from "@babylonjs/core";

/**
 * Action State tracked on every button.
 */
export interface ActionState {
  pressed: boolean;       // True only on the frame key goes down
  held: boolean;          // True as long as key is down
  released: boolean;      // True only on the frame key goes up
  holdDuration: number;   // Elapsed duration held (in milliseconds)
  tap: boolean;           // True on release if held < threshold
  hold: boolean;          // True precisely on the frame hold passes threshold (or held state holds it)
  holdTriggered: boolean; // Tracks if hold has already fired this press sequence
}

/**
 * Gamepad specific constants & configurations.
 */
export interface GamepadProfile {
  leftDeadzone: number;
  rightDeadzone: number;
  triggerThreshold: number;
}

/**
 * Control Settings & Profiles for Persistence.
 */
export interface ControlSettings {
  global: {
    activeDevice: "PC" | "Gamepad" | "Touch";
    tapHoldThreshold: number; // Milliseconds, default 300
    aimSensitivity: number;
    invertAimX: boolean;
    invertAimY: boolean;
    lockOnEnabled: boolean;
  };
  pc: {
    keybinds: { [actionId: string]: string };
    mouseSensitivity: number;
    mouseAimSmoothing: number;
    cursorLock: boolean;
  };
  gamepad: {
    leftDeadzone: number;
    rightDeadzone: number;
    triggerThreshold: number;
    vibrationEnabled: boolean;
    reconnectHandling: boolean;
  };
  touch: {
    draggable: boolean;
    resizable: boolean;
    opacity: number;
    analogSize: number;
    combatButtonScale: number;
    joystickOffset: { x: number; y: number };
    actionsOffset: { x: number; y: number };
  };
}

export const DEFAULT_SETTINGS: ControlSettings = {
  global: {
    activeDevice: "PC",
    tapHoldThreshold: 300,
    aimSensitivity: 1.0,
    invertAimX: false,
    invertAimY: false,
    lockOnEnabled: true,
  },
  pc: {
    keybinds: {
      MoveUp: "w",
      MoveDown: "s",
      MoveLeft: "a",
      MoveRight: "d",
      LockTarget: "tab",
      Main1: "lmb",      // Left Mouse Button
      Main2: "q",
      Off1: "rmb",      // Right Mouse Button
      Off2: "e",
      Dash: "v",
      WeaponStance: "`", // Tilde / Backtick trigger
      Interact: "f",
      Cancel: "r",
      Menu: "escape"
    },
    mouseSensitivity: 1.0,
    mouseAimSmoothing: 0.1,
    cursorLock: false,
  },
  gamepad: {
    leftDeadzone: 0.15,
    rightDeadzone: 0.15,
    triggerThreshold: 0.15,
    vibrationEnabled: true,
    reconnectHandling: true,
  },
  touch: {
    draggable: false,
    resizable: false,
    opacity: 0.94,
    analogSize: 1.0,
    combatButtonScale: 1.0,
    joystickOffset: { x: 0, y: 0 },
    actionsOffset: { x: 0, y: 0 }
  }
};

/**
 * Raw output state from device adapters.
 */
export interface DeviceRawInput {
  move: { x: number; y: number };
  aim: { x: number; y: number } | null;
  buttons: { [actionId: string]: boolean };
  aimVectorDirect?: Vector3; // directly resolved aim vector in 3D
}

/**
 * Interface that all device adapters must implement.
 */
export interface InputDeviceAdapter {
  id: string;
  name: string;
  update(deltaTimeSeconds: number): DeviceRawInput;
}

/**
 * Standard Keyboard + Mouse Device Adapter
 */
export class KeyboardMouseInputAdapter implements InputDeviceAdapter {
  public readonly id = "pc";
  public readonly name = "Keyboard & Mouse";

  private keys: { [key: string]: boolean } = {};
  private mouseButtons: { [btn: number]: boolean } = {};
  private getCameraYaw: () => number = () => 45 * (Math.PI / 180);
  private currentSettings: ControlSettings;

  constructor(settings: ControlSettings) {
    this.currentSettings = settings;
    this.initListeners();
  }

  public setSettings(settings: ControlSettings): void {
    this.currentSettings = settings;
  }

  public setCameraYawProvider(provider: () => number): void {
    this.getCameraYaw = provider;
  }

  private initListeners(): void {
    window.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = true;
      
      // Prevent browser default scroll behaviors for standard gaming keys
      if (key === " " || key === "tab" || key === "arrowup" || key === "arrowdown" || key === "arrowleft" || key === "arrowright") {
        e.preventDefault();
      }
    });

    window.addEventListener("keyup", (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = false;
    });

    window.addEventListener("mousedown", (e) => {
      const canvas = document.getElementById("renderCanvas");
      const appRoot = document.getElementById("appRoot");
      const target = e.target as HTMLElement;
      if (target && (target === canvas || target === appRoot || target.id === "root")) {
        this.mouseButtons[e.button] = true;
        
        if (this.currentSettings.pc.cursorLock && canvas) {
          canvas.requestPointerLock?.();
        }
      }
    });

    window.addEventListener("mouseup", (e) => {
      this.mouseButtons[e.button] = false;
    });

    window.addEventListener("blur", () => {
      this.keys = {};
      this.mouseButtons = {};
    });
  }

  public update(deltaTimeSeconds: number): DeviceRawInput {
    let dx = 0;
    let dy = 0;

    const bind = this.currentSettings.pc.keybinds;

    // Resolve move direction based on keys
    if (this.keys[bind["MoveUp"]?.toLowerCase()] || this.keys["arrowup"]) dy += 1;
    if (this.keys[bind["MoveDown"]?.toLowerCase()] || this.keys["arrowdown"]) dy -= 1;
    if (this.keys[bind["MoveLeft"]?.toLowerCase()] || this.keys["arrowleft"]) dx -= 1;
    if (this.keys[bind["MoveRight"]?.toLowerCase()] || this.keys["arrowright"]) dx += 1;

    // Resolve action buttons
    const buttons: { [actionId: string]: boolean } = {};

    const resolveBtn = (actionId: string): boolean => {
      const key = bind[actionId]?.toLowerCase() || "";
      if (key === "lmb") return this.mouseButtons[0] || false;
      if (key === "rmb") return this.mouseButtons[2] || false;
      return this.keys[key] || false;
    };

    const actionIds = [
      "LockTarget", "Main1", "Main2", "Off1", "Off2", 
      "Dash", "WeaponStance", "Interact", "Cancel", "Menu"
    ];

    for (const act of actionIds) {
      buttons[act] = resolveBtn(act);
    }

    return {
      move: { x: dx, y: dy },
      aim: null, // mouse does not use relative analog stick aim
      buttons
    };
  }
}

/**
 * Browser Gamepad API Adapter
 */
export class GamepadInputAdapter implements InputDeviceAdapter {
  public readonly id = "gamepad";
  public readonly name = "Gamepad Controller";

  private currentSettings: ControlSettings;
  private gamepadIndex: number | null = null;
  private getCameraYaw: () => number = () => 45 * (Math.PI / 180);

  constructor(settings: ControlSettings) {
    this.currentSettings = settings;
    this.initGamepadEvents();
  }

  public setSettings(settings: ControlSettings): void {
    this.currentSettings = settings;
  }

  public setCameraYawProvider(provider: () => number): void {
    this.getCameraYaw = provider;
  }

  private initGamepadEvents(): void {
    window.addEventListener("gamepadconnected", (e) => {
      console.log(`[Gamepad connected]: ${e.gamepad.id} at index ${e.gamepad.index}`);
      if (this.gamepadIndex === null) {
        this.gamepadIndex = e.gamepad.index;
      }
    });

    window.addEventListener("gamepaddisconnected", (e) => {
      console.log(`[Gamepad disconnected]: ${e.gamepad.id}`);
      if (this.gamepadIndex === e.gamepad.index) {
        this.gamepadIndex = null;
        // Search if other gamepad is connected
        const gps = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const gp of gps) {
          if (gp && gp.connected) {
            this.gamepadIndex = gp.index;
            break;
          }
        }
      }
    });
  }

  public vibrate(durationMs = 150, weakIntensity = 0.4, strongIntensity = 0.4): void {
    if (!this.currentSettings.gamepad.vibrationEnabled || this.gamepadIndex === null) return;
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gps[this.gamepadIndex];
    if (gp && (gp as any).vibrationActuator) {
      (gp as any).vibrationActuator.playEffect("dual-rumble", {
        startDelay: 0,
        duration: durationMs,
        weakMagnitude: weakIntensity,
        strongMagnitude: strongIntensity
      }).catch((e: any) => {});
    }
  }

  public update(deltaTimeSeconds: number): DeviceRawInput {
    const buttons: { [actionId: string]: boolean } = {};
    const defaultRaw: DeviceRawInput = {
      move: { x: 0, y: 0 },
      aim: null,
      buttons: {}
    };

    if (this.gamepadIndex === null) {
      // Look for active indices if disconnected/reconnected
      const gps = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of gps) {
        if (gp && gp.connected) {
          this.gamepadIndex = gp.index;
          break;
        }
      }
      if (this.gamepadIndex === null) return defaultRaw;
    }

    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gps[this.gamepadIndex];
    if (!gp || !gp.connected) return defaultRaw;

    // Sticks
    let moveX = gp.axes[0] || 0;
    let moveY = gp.axes[1] || 0;
    let aimX = gp.axes[2] || 0;
    let aimY = gp.axes[3] || 0;

    const gpset = this.currentSettings.gamepad;

    // Apply deadzones
    if (Math.abs(moveX) < gpset.leftDeadzone) moveX = 0;
    if (Math.abs(moveY) < gpset.leftDeadzone) moveY = 0;
    if (Math.abs(aimX) < gpset.rightDeadzone) aimX = 0;
    if (Math.abs(aimY) < gpset.rightDeadzone) aimY = 0;

    const btnPressed = (index: number): boolean => {
      const btn = gp.buttons[index];
      if (!btn) return false;
      return typeof btn === "object" ? btn.pressed : btn === 1.0;
    };

    const triggerValue = (index: number): number => {
      const btn = gp.buttons[index];
      if (!btn) return 0;
      return typeof btn === "object" ? btn.value : btn;
    };

    // Gamepad mappings based on specifications:
    // Left Analog (Move)
    // Right Analog (Aim)
    // R3 (11) -> LockTarget (Tap/Hold)
    buttons["LockTarget"] = btnPressed(11);

    // R1 (5) -> Main 1
    buttons["Main1"] = btnPressed(5);

    // R2 (7) -> Main 2
    buttons["Main2"] = triggerValue(7) > gpset.triggerThreshold;

    // L1 (4) -> Off 1
    buttons["Off1"] = btnPressed(4);

    // L2 (6) -> Off 2
    buttons["Off2"] = triggerValue(6) > gpset.triggerThreshold;

    // B Button (1 on standard mapping, sometimes index 1 is right face button)
    // Wait, B Tap (1) -> Dash
    buttons["Dash"] = btnPressed(1);

    // Y Button (3) -> Weapon Swap / Stance Swap
    buttons["WeaponStance"] = btnPressed(3);

    // A Button (0) -> Interact
    buttons["Interact"] = btnPressed(0);

    // X Button (2) -> Cancel
    buttons["Cancel"] = btnPressed(2);

    // Start Button (9) -> Menu / Esc
    buttons["Menu"] = btnPressed(9);

    // Rotate aim vector to the camera system orientation
    let finalAim: { x: number; y: number } | null = null;
    let aimVectorDirect: Vector3 | undefined = undefined;

    if (aimX !== 0 || aimY !== 0) {
      finalAim = { x: aimX, y: aimY };
      
      const yaw = this.getCameraYaw();
      const mappedAimY = -aimY; // Pushing up means pointing forward in 3D
      const fx = -Math.sin(yaw) * mappedAimY + Math.cos(yaw) * aimX;
      const fz = Math.cos(yaw) * mappedAimY + Math.sin(yaw) * aimX;
      const aimDir = new Vector3(fx, 0, fz);
      if (aimDir.length() > 0.01) {
        aimDir.normalize();
        aimVectorDirect = aimDir;
      }
    }

    return {
      move: { x: moveX, y: -moveY }, // invert physical forward stick pushing
      aim: finalAim,
      buttons,
      aimVectorDirect
    };
  }
}

/**
 * On-screen Touch Controls Adapter
 */
export class TouchInputAdapter implements InputDeviceAdapter {
  public readonly id = "touch";
  public readonly name = "Touch Controls";

  private currentSettings: ControlSettings;
  private joystickX = 0;
  private joystickY = 0;
  private joystickActive = false;

  private aimJoystickX = 0;
  private aimJoystickY = 0;
  private aimJoystickActive = false;

  private buttons: { [actionId: string]: boolean } = {};
  private getCameraYaw: () => number = () => 45 * (Math.PI / 180);

  constructor(settings: ControlSettings) {
    this.currentSettings = settings;
  }

  public setSettings(settings: ControlSettings): void {
    this.currentSettings = settings;
  }

  public setCameraYawProvider(provider: () => number): void {
    this.getCameraYaw = provider;
  }

  public feedJoystick(x: number, y: number, active: boolean): void {
    this.joystickX = x;
    this.joystickY = y;
    this.joystickActive = active;
  }

  public feedAimJoystick(x: number, y: number, active: boolean): void {
    this.aimJoystickX = x;
    this.aimJoystickY = y;
    this.aimJoystickActive = active;
  }

  public setButtonState(actionId: string, pressed: boolean): void {
    this.buttons[actionId] = pressed;
  }

  public update(deltaTimeSeconds: number): DeviceRawInput {
    // Collect on-screen virtual state
    const currentBtns = { ...this.buttons };

    let finalAim: { x: number; y: number } | null = null;
    let aimVectorDirect: Vector3 | undefined = undefined;

    if (this.aimJoystickActive && (this.aimJoystickX !== 0 || this.aimJoystickY !== 0)) {
      finalAim = { x: this.aimJoystickX, y: this.aimJoystickY };
      
      const yaw = this.getCameraYaw();
      // Pushing right stick up means y > 0.
      // So we map this to 3D space: if push up, mappedAimY is positive.
      const mappedAimY = this.aimJoystickY;
      const fx = -Math.sin(yaw) * mappedAimY + Math.cos(yaw) * this.aimJoystickX;
      const fz = Math.cos(yaw) * mappedAimY + Math.sin(yaw) * this.aimJoystickX;
      const aimDir = new Vector3(fx, 0, fz);
      if (aimDir.length() > 0.01) {
        aimDir.normalize();
        aimVectorDirect = aimDir;
      }
      
      // Auto-fire R1 (Primary weapon) if dragging right stick to aim! This mimics physical gamepad twin-stick behavior
      currentBtns["Main1"] = true;
    }

    return {
      move: this.joystickActive ? { x: this.joystickX, y: this.joystickY } : { x: 0, y: 0 },
      aim: finalAim,
      buttons: currentBtns,
      aimVectorDirect
    };
  }
}

/**
 * Unified Game Input Manager.
 * Glues together PC, Gamepad, and Touch into a centralized action system.
 */
export class InputManager {
  private static instance: InputManager | null = null;

  public settings: ControlSettings = { ...DEFAULT_SETTINGS };
  
  public pcAdapter!: KeyboardMouseInputAdapter;
  public gamepadAdapter!: GamepadInputAdapter;
  public touchAdapter!: TouchInputAdapter;

  private actionStates: { [actionId: string]: ActionState } = {};
  private getCameraYaw: () => number = () => 45 * (Math.PI / 180);

  // Consolidated movement and aiming coordinates
  private moveDirection: Vector3 = Vector3.Zero();
  private aimVector: Vector3 | null = null;
  private activeDevice: "PC" | "Gamepad" | "Touch" = "PC";

  public onSettingsChanged: (s: ControlSettings) => void = () => {};

  public static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  private constructor() {
    this.loadSettings();

    this.pcAdapter = new KeyboardMouseInputAdapter(this.settings);
    this.gamepadAdapter = new GamepadInputAdapter(this.settings);
    this.touchAdapter = new TouchInputAdapter(this.settings);

    // Setup action states initially
    const actionIds = [
      "LockTarget", "Main1", "Main2", "Off1", "Off2", 
      "Dash", "WeaponStance", "Interact", "Cancel", "Menu"
    ];

    for (const act of actionIds) {
      this.actionStates[act] = {
        pressed: false,
        held: false,
        released: false,
        holdDuration: 0,
        tap: false,
        hold: false,
        holdTriggered: false
      };
    }
  }

  public setCameraYawProvider(provider: () => number): void {
    this.getCameraYaw = provider;
    this.pcAdapter.setCameraYawProvider(provider);
    this.gamepadAdapter.setCameraYawProvider(provider);
    this.touchAdapter.setCameraYawProvider(provider);
  }

  /**
   * Load controls from custom storage slot
   */
  public loadSettings(): void {
    try {
      const stored = localStorage.getItem("orion_control_settings_v1");
      if (stored) {
        const parsed = JSON.parse(stored);
        // deep merge default layout with stored
        this.settings = {
          global: { ...DEFAULT_SETTINGS.global, ...parsed.global },
          pc: {
            ...DEFAULT_SETTINGS.pc,
            ...parsed.pc,
            keybinds: { ...DEFAULT_SETTINGS.pc.keybinds, ...(parsed.pc?.keybinds || {}) }
          },
          gamepad: { ...DEFAULT_SETTINGS.gamepad, ...parsed.gamepad },
          touch: { ...DEFAULT_SETTINGS.touch, ...parsed.touch }
        };
        this.activeDevice = this.settings.global.activeDevice || "PC";
      } else {
        this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      }
    } catch (e) {
      console.warn("[InputSystem]: Failed to read stored input configuration, fallback to default", e);
      this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }
  }

  /**
   * Save controls locally
   */
  public saveSettings(): void {
    try {
      this.settings.global.activeDevice = this.activeDevice;
      localStorage.setItem("orion_control_settings_v1", JSON.stringify(this.settings));
      
      // Update adapters
      this.pcAdapter.setSettings(this.settings);
      this.gamepadAdapter.setSettings(this.settings);
      this.touchAdapter.setSettings(this.settings);
      
      this.onSettingsChanged(this.settings);
    } catch (e) {
      console.warn("[InputSystem]: Failed to save control settings locally", e);
    }
  }

  /**
   * Reset parameters to standard profile
   */
  public resetToDefault(): void {
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    this.saveSettings();
  }

  public update(deltaTimeSeconds: number): void {
    // 1. Gather raw inputs from each adapter
    const rawPc = this.pcAdapter.update(deltaTimeSeconds);
    const rawGamepad = this.gamepadAdapter.update(deltaTimeSeconds);
    const rawTouch = this.touchAdapter.update(deltaTimeSeconds);

    // 2. Perform Active Input Device Detection based on activity triggers
    const pcHasActivity = (Math.abs(rawPc.move.x) > 0.1 || Math.abs(rawPc.move.y) > 0.1 || Object.values(rawPc.buttons).some(v => v));
    const gamepadHasActivity = (Math.abs(rawGamepad.move.x) > 0.1 || Math.abs(rawGamepad.move.y) > 0.1 || rawGamepad.aim !== null || Object.values(rawGamepad.buttons).some(v => v));
    const touchHasActivity = (Math.abs(rawTouch.move.x) > 0.05 || Math.abs(rawTouch.move.y) > 0.05 || rawTouch.aim !== null || Object.values(rawTouch.buttons).some(v => v));

    if (touchHasActivity) {
      this.activeDevice = "Touch";
    } else if (gamepadHasActivity) {
      this.activeDevice = "Gamepad";
    } else if (pcHasActivity) {
      this.activeDevice = "PC";
    }

    // 3. Resolve consolidated move direction vector relative to camera face yaw
    let moveDX = 0;
    let moveDY = 0;

    if (this.activeDevice === "PC") {
      moveDX = rawPc.move.x;
      moveDY = rawPc.move.y;
    } else if (this.activeDevice === "Gamepad") {
      moveDX = rawGamepad.move.x;
      moveDY = rawGamepad.move.y;
    } else if (this.activeDevice === "Touch") {
      moveDX = rawTouch.move.x;
      moveDY = rawTouch.move.y;
    }

    this.moveDirection.setAll(0);
    if (moveDX !== 0 || moveDY !== 0) {
      const yaw = this.getCameraYaw();
      const fx = -Math.sin(yaw) * moveDY + Math.cos(yaw) * moveDX;
      const fz = Math.cos(yaw) * moveDY + Math.sin(yaw) * moveDX;
      this.moveDirection.set(fx, 0, fz);
      if (this.moveDirection.length() > 0) {
        this.moveDirection.normalize();
      }
    }

    // 4. Resolve aiming vector
    this.aimVector = null;
    if (this.activeDevice === "Gamepad" && rawGamepad.aimVectorDirect) {
      this.aimVector = rawGamepad.aimVectorDirect;
    } else if (this.activeDevice === "Touch" && rawTouch.aimVectorDirect) {
      this.aimVector = rawTouch.aimVectorDirect;
    }

    // 5. Update multi-device action buttons with tap-hold timing thresholds
    const threshold = this.settings.global.tapHoldThreshold;

    for (const actId in this.actionStates) {
      // Button is pressed if ANY active device Adapter presses it
      const isDown = rawPc.buttons[actId] || rawGamepad.buttons[actId] || rawTouch.buttons[actId];
      const state = this.actionStates[actId];

      if (isDown) {
        if (!state.held) {
          // Just pressed
          state.pressed = true;
          state.held = true;
          state.released = false;
          state.holdDuration = 0;
          state.hold = false;
          state.tap = false;
          state.holdTriggered = false;
        } else {
          // Continuous hold
          state.pressed = false;
          state.holdDuration += deltaTimeSeconds * 1000;
          if (state.holdDuration >= threshold && !state.holdTriggered) {
            state.hold = true;
            state.holdTriggered = true;
          } else {
            state.hold = false;
          }
        }
      } else {
        if (state.held) {
          // Just released
          state.pressed = false;
          state.held = false;
          state.released = true;
          if (state.holdDuration < threshold && !state.holdTriggered) {
            state.tap = true;
          } else {
            state.tap = false;
          }
          state.hold = false;
        } else {
          // Idle untouched state
          state.pressed = false;
          state.released = false;
          state.tap = false;
          state.hold = false;
        }
      }
    }
  }

  /**
   * Quick access to check current action state.
   */
  public getAction(actionId: string): ActionState {
    return this.actionStates[actionId] || {
      pressed: false,
      held: false,
      released: false,
      holdDuration: 0,
      tap: false,
      hold: false,
      holdTriggered: false
    };
  }

  public getMoveDirection(): Vector3 {
    return this.moveDirection;
  }

  public getAimVector(): Vector3 | null {
    return this.aimVector;
  }

  public getActiveDeviceName(): "PC" | "Gamepad" | "Touch" {
    return this.activeDevice;
  }

  /**
   * Helper to manually trigger vibration if gamepad is connected on game events.
   */
  public pulseVibration(durationMs = 120, weak = 0.35, strong = 0.35): void {
    this.gamepadAdapter.vibrate(durationMs, weak, strong);
  }
}
