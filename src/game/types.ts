/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Vector3, Color3 } from "@babylonjs/core";

export interface GameSettings {
  movement: {
    speed: number;
    rotationSpeed: number;
  };
  camera: {
    fov: number;
    distance: number;
    minZoom: number;
    maxZoom: number;
    zoomSpeed: number;
    followLerp: number;
    pitch: number; // in radians
    yaw: number;   // in radians
  };
  rendering: {
    shadows: boolean;
    postProcessing: {
      enabled: boolean;
      glowIntensity: number;
      bloomWeight: number;
      exposure: number;
      tonemapping: number; // ImageProcessingConfiguration.TONEMAPPING_ACES = 1, etc.
    };
    environment: {
      arenaSize: number;
      gridSpacing: number;
      theme: "cyber" | "magma" | "wasteland" | "matrix";
    };
  };
}

export interface PerformanceStats {
  fps: number;
  frameTime: number;
  drawCalls: number;
  activeParticles: number;
  meshCount: number;
  verticesCount: number;
}

export interface PlayerInput {
  moveDirection: Vector3;
  isFiring: boolean;
  isDashing: boolean;
  dashTriggered: boolean;
  secondaryTriggered: boolean;
  selectedAbility: number; // 0, 1, 2
}

export interface FXTrigger {
  type: "projectile" | "beam" | "explosion" | "dash" | "impact";
  origin: Vector3;
  target?: Vector3;
  color?: Color3;
}

export interface ModelAssetInfo {
  id: string;
  name: string;
  type: "character" | "environment" | "prop";
  source: "procedural" | "file";
  filePath?: string;
  meshCount: number;
}
