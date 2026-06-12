/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Vector3 } from "@babylonjs/core";
import { PlayerInput } from "../types";
import { InputManager } from "./InputSystem";

/**
 * Backward-compatible InputController proxy mapping to the central InputManager.
 */
export class InputController {
  private inputState: PlayerInput = {
    moveDirection: Vector3.Zero(),
    isFiring: false,
    isDashing: false,
    dashTriggered: false,
    secondaryTriggered: false,
    selectedAbility: 0,
  };

  // Camera yaw angle retriever for camera-relative translations
  private getCameraYaw: () => number = () => 45 * (Math.PI / 180);

  // Reentrancy guard to prevent recursive stack overflow when callback events invoke getInputState()
  private isEvaluatingEvents = false;

  // Trigger callbacks for backward compatibility
  public onDashPressed: () => void = () => {};
  public onFirePressed: (targetWorldPoint?: Vector3) => void = () => {};
  public onAbilityPressed: (index: number) => void = () => {};
  public onCancelPressed: () => void = () => {};

  constructor() {
    const im = InputManager.getInstance();
    im.setCameraYawProvider(() => this.getCameraYaw());
  }

  /**
   * Register a custom provider callback to query current camera yaw rotation
   */
  public setCameraYawProvider(provider: () => number): void {
    this.getCameraYaw = provider;
    InputManager.getInstance().setCameraYawProvider(provider);
  }

  /**
   * Directly feed virtual joystick values on touch devices
   */
  public handleJoystickUpdate(dx: number, dy: number, isActive: boolean): void {
    InputManager.getInstance().touchAdapter.feedJoystick(dx, dy, isActive);
  }

  /**
   * Directly feed virtual aim joystick values on touch devices
   */
  public handleAimJoystickUpdate(dx: number, dy: number, isActive: boolean): void {
    InputManager.getInstance().touchAdapter.feedAimJoystick(dx, dy, isActive);
  }

  /**
   * Set firing state from UI buttons
   */
  public setFiring(isFiring: boolean): void {
    InputManager.getInstance().touchAdapter.setButtonState("Main1", isFiring);
    if (isFiring) {
      this.onFirePressed();
    }
  }

  /**
   * Trigger modular abilities from external overlay UI buttons
   */
  public triggerAbility(index: number): void {
    if (index === 1) {
      InputManager.getInstance().touchAdapter.setButtonState("Main2", true);
      setTimeout(() => InputManager.getInstance().touchAdapter.setButtonState("Main2", false), 100);
    } else if (index === 2) {
      InputManager.getInstance().touchAdapter.setButtonState("Off2", true);
      setTimeout(() => InputManager.getInstance().touchAdapter.setButtonState("Off2", false), 100);
    } else {
      InputManager.getInstance().touchAdapter.setButtonState("Off1", true);
      setTimeout(() => InputManager.getInstance().touchAdapter.setButtonState("Off1", false), 100);
    }
    this.onAbilityPressed(index);
  }

  /**
   * Trigger dash from overlay button
   */
  public triggerDash(): void {
    InputManager.getInstance().touchAdapter.setButtonState("Dash", true);
    this.onDashPressed();
    setTimeout(() => {
      InputManager.getInstance().touchAdapter.setButtonState("Dash", false);
    }, 150);
  }

  /**
   * Evaluate the vector to determine desired heading or translation.
   * Returns a normalized vector of motion mapped to standard 3D space.
   */
  public updateMoveDirection(): void {
    // Already handled centrally by InputManager
  }

  /**
   * Returns current consolidated controller state.
   */
  public getInputState(): PlayerInput {
    const im = InputManager.getInstance();
    
    // Process moveDirection relative to camera yaw
    const moveDir = im.getMoveDirection();
    this.inputState.moveDirection.copyFrom(moveDir);

    // Map individual button action states
    const main1 = im.getAction("Main1");
    const main2 = im.getAction("Main2");
    const off1 = im.getAction("Off1");
    const off2 = im.getAction("Off2");
    const dash = im.getAction("Dash");
    
    this.inputState.isFiring = main1.held;
    this.inputState.isDashing = dash.held;
    this.inputState.dashTriggered = dash.pressed;
    this.inputState.secondaryTriggered = off1.pressed;

    if (main2.pressed) this.inputState.selectedAbility = 1;
    if (off2.pressed) this.inputState.selectedAbility = 2;
    if (off1.pressed) this.inputState.selectedAbility = 0;

    // Set Aim Direction
    const aimDir = im.getAimVector();
    if (aimDir) {
      this.inputState.aimDirection = aimDir;
    } else {
      this.inputState.aimDirection = undefined;
    }

    // Call press events on the legacy callbacks if pressed this frame
    if (!this.isEvaluatingEvents) {
      this.isEvaluatingEvents = true;
      try {
        if (dash.pressed) this.onDashPressed();
        if (main1.pressed) this.onFirePressed();
        if (main2.pressed) this.onAbilityPressed(1);
        if (off2.pressed) this.onAbilityPressed(2);
        if (off1.pressed) this.onAbilityPressed(0);
        if (im.getAction("Cancel").pressed) this.onCancelPressed();
      } finally {
        this.isEvaluatingEvents = false;
      }
    }

    return this.inputState;
  }

  /**
   * Clears single-instant trigger actions to prevent looping
   */
  public clearTriggers(): void {
    // Managed natively by Centralized Action States
  }
}
