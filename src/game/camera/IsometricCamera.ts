/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Scene, UniversalCamera, Vector3, Tools } from "@babylonjs/core";
import { GameSettings } from "../types";

export class IsometricCamera {
  private camera: UniversalCamera;
  private scene: Scene;
  private settings: GameSettings["camera"];
  
  // Tracking state
  private targetPosition: Vector3 = Vector3.Zero();
  private currentInterpolatedTarget: Vector3 = Vector3.Zero();
  private currentDistance: number;
  private targetDistance: number;

  // Shake FX state
  private shakeOffset: Vector3 = Vector3.Zero();
  private shakeIntensity = 0;
  private shakeDecay = 0.9;

  // Pinch-to-zoom tracking
  private previousTouchDistance = 0;

  constructor(scene: Scene, canvas: HTMLCanvasElement, initialTrack: Vector3, config: GameSettings["camera"]) {
    this.scene = scene;
    this.settings = config;
    this.currentDistance = config.distance;
    this.targetDistance = config.distance;

    this.targetPosition.copyFrom(initialTrack);
    this.currentInterpolatedTarget.copyFrom(initialTrack);

    // Create custom camera positioning
    this.camera = new UniversalCamera("IsoCombatCamera", Vector3.Zero(), this.scene);
    this.camera.fov = this.settings.fov;
    this.camera.minZ = 1.0;
    this.camera.maxZ = 500.0;
    
    this.updateCameraPosition(true);
    
    // Register event listeners
    this.registerZoomEvents(canvas);
  }

  public getCameraInstance(): UniversalCamera {
    return this.camera;
  }

  /**
   * Applies temporary geometric camera shake on firing heavy shells or explosion impacts
   */
  public triggerShake(intensity = 0.5): void {
    this.shakeIntensity = Math.min(this.shakeIntensity + intensity, 2.5);
  }

  /**
   * Directly sets the instantaneous tracking coordinates (usually player coords)
   */
  public setTarget(pos: Vector3): void {
    this.targetPosition.copyFrom(pos);
  }

  /**
   * Adjust config options from live debug panels
   */
  public updateConfig(newConfig: Partial<GameSettings["camera"]>): void {
    this.settings = { ...this.settings, ...newConfig };
    this.camera.fov = this.settings.fov;
  }

  private registerZoomEvents(canvas: HTMLCanvasElement): void {
    // 1. Mouse Wheel Zooming
    canvas.addEventListener("wheel", (e) => {
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      this.targetDistance = Math.max(
        this.settings.minZoom,
        Math.min(this.settings.maxZoom, this.targetDistance * zoomFactor)
      );
      e.preventDefault();
    }, { passive: false });

    // 2. Mobile Pinch Sensing
    canvas.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        this.previousTouchDistance = this.getTouchDistance(e.touches);
      }
    }, { passive: true });

    canvas.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2) {
        const currentDist = this.getTouchDistance(e.touches);
        if (this.previousTouchDistance > 0) {
          const delta = this.previousTouchDistance - currentDist;
          const multi = delta > 0 ? 1.05 : 0.95;
          this.targetDistance = Math.max(
            this.settings.minZoom,
            Math.min(this.settings.maxZoom, this.targetDistance * multi)
          );
        }
        this.previousTouchDistance = currentDist;
      }
    }, { passive: true });

    canvas.addEventListener("touchend", () => {
      this.previousTouchDistance = 0;
    });
  }

  private getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculates structural coordinates based on isometric angles, yaw, and target tracking.
   * Invoked in the graphics cycle to render flawless tracking frames.
   */
  public update(deltaTimeSeconds: number): void {
    // Smooth camera distance tracking
    this.currentDistance = this.currentDistance + (this.targetDistance - this.currentDistance) * this.settings.zoomSpeed;

    // Interpolate target tracking coordinates to dampen fast translations
    const lerpAmt = Math.min(1.0, this.settings.followLerp * (deltaTimeSeconds * 60));
    Vector3.LerpToRef(this.currentInterpolatedTarget, this.targetPosition, lerpAmt, this.currentInterpolatedTarget);

    // Apply decayed camera shake forces
    if (this.shakeIntensity > 0.01) {
      const angle = Math.random() * Math.PI * 2;
      const radius = this.shakeIntensity * 0.15;
      this.shakeOffset.set(
        Math.cos(angle) * radius,
        (Math.random() - 0.5) * radius * 0.5,
        Math.sin(angle) * radius
      );
      this.shakeIntensity *= this.shakeDecay;
    } else {
      this.shakeOffset.setAll(0);
    }

    this.updateCameraPosition();
  }

  private updateCameraPosition(snap = false): void {
    const pitch = this.settings.pitch;
    const yaw = this.settings.yaw;
    const dist = this.currentDistance;

    // Calculate displacement based on angles (yaw and pitch layout)
    // Z is forward/back, X is left/right, Y is altitude
    const hDist = dist * Math.cos(pitch);
    const vDist = dist * Math.sin(pitch);

    const xOffset = hDist * Math.sin(yaw);
    const zOffset = -hDist * Math.cos(yaw);
    const yOffset = vDist;

    const basePosition = new Vector3(
      this.currentInterpolatedTarget.x + xOffset,
      this.currentInterpolatedTarget.y + yOffset,
      this.currentInterpolatedTarget.z + zOffset
    );

    // Offset camera position
    if (snap) {
      this.camera.position.copyFrom(basePosition);
    } else {
      // Small lerp on camera translation avoids jitter
      this.camera.position.copyFrom(basePosition);
    }

    // Camera looks directly at the interpolated player coordinate + shake offsets
    const finalLookTarget = this.currentInterpolatedTarget.add(this.shakeOffset);
    this.camera.setTarget(finalLookTarget);
  }
}
