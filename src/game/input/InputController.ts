/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Vector3 } from "@babylonjs/core";
import { PlayerInput } from "../types";

export class InputController {
  private keys: { [key: string]: boolean } = {};
  private inputState: PlayerInput = {
    moveDirection: Vector3.Zero(),
    isFiring: false,
    isDashing: false,
    dashTriggered: false,
    secondaryTriggered: false,
    selectedAbility: 0,
  };

  // Joystick state
  private joystickActive = false;
  private joystickStartPos = { x: 0, y: 0 };
  private joystickCurPos = { x: 0, y: 0 };
  private joystickVector = { x: 0, y: 0 };
  private maxJoystickDist = 60; // Max drag range in pixels

  // Camera yaw angle retriever for camera-relative translations
  private getCameraYaw: () => number = () => 45 * (Math.PI / 180);

  // Trigger callbacks
  public onDashPressed: () => void = () => {};
  public onFirePressed: (targetWorldPoint?: Vector3) => void = () => {};
  public onAbilityPressed: (index: number) => void = () => {};
  public onCancelPressed: () => void = () => {};

  constructor() {
    this.initKeyboard();
    this.initMouse();
  }

  /**
   * Register a custom provider callback to query current camera yaw rotation
   */
  public setCameraYawProvider(provider: () => number): void {
    this.getCameraYaw = provider;
  }

  private initKeyboard(): void {
    window.addEventListener("keydown", (e) => {
      this.keys[e.key.toLowerCase()] = true;
      
      if (e.key === " " || e.key.toLowerCase() === "spacebar") {
        this.inputState.isDashing = true;
        this.inputState.dashTriggered = true;
        this.onDashPressed();
        e.preventDefault();
      }
      if (e.key.toLowerCase() === "q" || e.key === "1") {
        this.inputState.selectedAbility = 1;
        this.onAbilityPressed(1);
      }
      if (e.key.toLowerCase() === "e" || e.key === "2") {
        this.inputState.selectedAbility = 2;
        this.onAbilityPressed(2);
      }
      if (e.key.toLowerCase() === "f") {
        this.inputState.secondaryTriggered = true;
        this.onAbilityPressed(0);
      }
      if (e.key.toLowerCase() === "x") {
        this.onCancelPressed();
      }
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.key.toLowerCase()] = false;
      if (e.key === " " || e.key.toLowerCase() === "spacebar") {
        this.inputState.isDashing = false;
      }
    });

    // Handle blur
    window.addEventListener("blur", () => {
      this.keys = {};
      this.inputState.moveDirection.setAll(0);
      this.inputState.isFiring = false;
      this.inputState.isDashing = false;
    });
  }

  private initMouse(): void {
    window.addEventListener("mousedown", (e) => {
      // Direct clicks that are not on UI panels trigger fire
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "CANVAS" || target.id === "root")) {
        this.inputState.isFiring = true;
        this.onFirePressed();
      }
    });

    window.addEventListener("mouseup", () => {
      this.inputState.isFiring = false;
    });
  }

  /**
   * Directly feed virtual joystick values on touch devices
   */
  public handleJoystickUpdate(dx: number, dy: number, isActive: boolean): void {
    this.joystickActive = isActive;
    if (isActive) {
      // In 2.5D, dy triggers move along Z-axis, dx triggers move along X-axis
      // Map screen dx, dy to 3D movement coordinates:
      // dx drives X (right), dy drives Z (forward/backward)
      this.joystickVector = { x: dx, y: dy };
    } else {
      this.joystickVector = { x: 0, y: 0 };
    }
  }

  /**
   * Set firing state from UI buttons
   */
  public setFiring(isFiring: boolean): void {
    this.inputState.isFiring = isFiring;
    if (isFiring) {
      this.onFirePressed();
    }
  }

  /**
   * Trigger modular abilities from external overlay UI buttons
   */
  public triggerAbility(index: number): void {
    this.inputState.selectedAbility = index;
    this.onAbilityPressed(index);
  }

  /**
   * Trigger dash from overlay button
   */
  public triggerDash(): void {
    this.inputState.isDashing = true;
    this.inputState.dashTriggered = true;
    this.onDashPressed();
    setTimeout(() => {
      this.inputState.isDashing = false;
    }, 150);
  }

  /**
   * Evaluate the vector to determine desired heading or translation.
   * Returns a normalized vector of motion mapped to standard 3D space.
   */
  public updateMoveDirection(): void {
    let dx = 0;
    let dz = 0;

    // 1. Process Keyboard Axis inputs
    if (this.keys["w"] || this.keys["arrowup"]) {
      dz += 1;
    }
    if (this.keys["s"] || this.keys["arrowdown"]) {
      dz -= 1;
    }
    if (this.keys["a"] || this.keys["arrowleft"]) {
      dx -= 1;
    }
    if (this.keys["d"] || this.keys["arrowright"]) {
      dx += 1;
    }

    let inputX = dx;
    let inputY = dz;

    // 2. Process Joystick inputs (override or combine)
    if (this.joystickActive && (this.joystickVector.x !== 0 || this.joystickVector.y !== 0)) {
      inputX = this.joystickVector.x;
      inputY = -this.joystickVector.y; // Invert vertical slider to translate UP drags positively
    }

    let dir = new Vector3(0, 0, 0);

    if (inputX !== 0 || inputY !== 0) {
      const yaw = this.getCameraYaw();
      // Calculate movement relative to the camera face projected on the ground
      // Forward direction away from camera: (-sin(yaw), 0, cos(yaw))
      // Right direction relative to camera: (cos(yaw), 0, sin(yaw))
      const fx = -Math.sin(yaw) * inputY + Math.cos(yaw) * inputX;
      const fz = Math.cos(yaw) * inputY + Math.sin(yaw) * inputX;
      dir.set(fx, 0, fz);
    }

    if (dir.length() > 0) {
      dir.normalize();
    }

    this.inputState.moveDirection.copyFrom(dir);
  }

  /**
   * Returns current consolidated controller state.
   */
  public getInputState(): PlayerInput {
    this.updateMoveDirection();
    return this.inputState;
  }

  /**
   * Clears single-instant trigger actions to prevent looping
   */
  public clearTriggers(): void {
    this.inputState.dashTriggered = false;
    this.inputState.secondaryTriggered = false;
  }
}
