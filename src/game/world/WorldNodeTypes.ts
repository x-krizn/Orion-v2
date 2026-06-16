/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Vector3, Color3 } from "@babylonjs/core";

export enum WorldNodeId {
  WAKE_SITE = "WAKE_SITE",
  ORC_SKIRMISH = "ORC_SKIRMISH",
  POE_BEACON = "POE_BEACON",
  BOG_CROSSING = "BOG_CROSSING",
  BEDIVERE_REST = "BEDIVERE_REST",
  WURM_SIGNS = "WURM_SIGNS",
  WURM_ARENA = "WURM_ARENA"
}

export interface NodeAmbienceSettings {
  fogColor: Color3;
  fogDensity: number;
  lightDirection?: Vector3;
  lightColor: Color3;
  lightIntensity: number;
  particleType: "embers" | "toxic_spits" | "spores" | "fog" | "none";
  audioCueId: string;
}

export interface WorldNode {
  id: WorldNodeId;
  name: string;
  description: string;
  center: Vector3;
  radius: number;
  ambience: NodeAmbienceSettings;
  preloadModels?: string[];
  
  // Custom hooks
  onEntry?: (gameManager: any) => void;
  onExit?: (gameManager: any) => void;
}
