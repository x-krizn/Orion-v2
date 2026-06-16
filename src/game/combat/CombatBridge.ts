/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Vector3 } from "@babylonjs/core";
import { GameplayAction } from "../types";
import { InputManager } from "../input/InputSystem";

export type CombatActionSignal = 
  | "Main1" | "Main1Hold"
  | "Main2" | "Main2Hold"
  | "Off1" | "Off1Hold"
  | "Off2" | "Off2Hold"
  | "Dash"
  | "Cancel";

export class CombatBridge {
  // Set to protect against repeated actions triggering while matching holds
  private activeHoldFires: Set<string> = new Set();

  /**
   * Translates incoming high-level combat signals into structured state adjustments
   */
  public requestAction(signal: CombatActionSignal, gameManager: any): void {
    const player = gameManager.player;
    if (!player) return;

    // 1. Guard against continuous hold spam
    if (signal.endsWith("Hold")) {
      const baseSignal = signal.replace("Hold", "");
      if (this.activeHoldFires.has(baseSignal)) {
        return; // hold already active and triggered, skip spam
      }
      this.activeHoldFires.add(baseSignal);
    } else {
      // If we got a standard tap/press signal, clear any current hold block for it
      this.activeHoldFires.delete(signal);
    }

    switch (signal) {
      case "Main1":
      case "Main1Hold": {
        if (player.isOverheated) {
          console.log("[Combat Warning]: Cannons locked due to overheat scan.");
          return;
        }
        const isPowerstance = player.stance === "powerstance";
        if (!isPowerstance) {
          const action: GameplayAction = {
            id: "standard_r1",
            name: "PULSE MULTI-FIRE",
            duration: 0.15,
            elapsed: 0,
            cancelable: true,
            type: "skill",
            onComplete: () => {
              gameManager.fireActiveArm();
            }
          };
          player.triggerAction(action);
        } else {
          const action: GameplayAction = {
            id: "powerstance_r1",
            name: "DUAL BLADE SLASH",
            duration: 0.32,
            elapsed: 0,
            cancelable: true,
            type: "skill",
            onComplete: () => {
              player.increaseHeat(12);
              const playerPos = player.getPosition();
              gameManager.fx.spawnExplosion(playerPos, 12, 0.9);
              gameManager.cameraSystem.triggerShake(0.32);
              
              const forward = player.getRootNode().forward || new Vector3(0, 0, 1);
              const targets = [...gameManager.spawnedEnemies];
              targets.forEach(e => {
                const toEnemy = e.node.position.subtract(playerPos);
                const dist = toEnemy.length();
                if (dist < 6.8) {
                  toEnemy.normalize();
                  const dot = Vector3.Dot(forward, toEnemy);
                  if (dot > 0.32) {
                    gameManager.damageEnemy(e, 145);
                  }
                }
              });
            }
          };
          player.triggerAction(action);
        }
        break;
      }

      case "Main2":
      case "Main2Hold": {
        if (player.isOverheated) return;
        const isPowerstance = player.stance === "powerstance";
        if (!isPowerstance) {
          const action: GameplayAction = {
            id: "standard_r2",
            name: "MORTAR TARGETING",
            duration: 1.1,
            elapsed: 0,
            cancelable: true,
            type: "charge",
            onComplete: () => {
              player.increaseHeat(20);
              gameManager.triggerTaticalOrbitalBombardment();
            }
          };
          player.triggerAction(action);
        } else {
          const action: GameplayAction = {
            id: "powerstance_r2",
            name: "CROSS ENERGY WAVE",
            duration: 0.85,
            elapsed: 0,
            cancelable: true,
            type: "charge",
            onComplete: () => {
              player.increaseHeat(18);
              const playerPos = player.getPosition();
              const forward = player.getRootNode().forward || new Vector3(0, 0, 1);
              
              for (let i = 1; i <= 3; i++) {
                const impactPoint = playerPos.add(forward.scale(i * 4.6));
                setTimeout(() => {
                  if (gameManager.isDisposed) return;
                  gameManager.fx.spawnExplosion(impactPoint, 6, 0.8);
                  gameManager.cameraSystem.triggerShake(0.3);
                  const targets = [...gameManager.spawnedEnemies];
                  targets.forEach(e => {
                    if (Vector3.Distance(e.node.position, impactPoint) < 4.2) {
                      gameManager.damageEnemy(e, 190);
                    }
                  });
                }, i * 140);
              }
            }
          };
          player.triggerAction(action);
        }
        break;
      }

      case "Off1":
      case "Off1Hold": {
        const isPowerstance = player.stance === "powerstance";
        if (!isPowerstance) {
          const cost = 15;
          if (player.en < cost) {
            console.log("[Combat Block]: Deficient EN energy!");
            return;
          }
          player.en -= cost;
          
          const action: GameplayAction = {
            id: "aegis_block",
            name: "AEGIS SHIELD BARRIER",
            duration: 2.2,
            elapsed: 0,
            cancelable: true,
            type: "channel",
            onComplete: () => {
              console.log("[Shield Collapse]: Barrier down.");
            }
          };
          player.triggerAction(action);
        } else {
          const action: GameplayAction = {
            id: "parry_action",
            name: "DEFLECTION DEFLECT PARRY",
            duration: 0.45,
            elapsed: 0,
            cancelable: true,
            type: "skill",
            onComplete: () => {
              console.log("[Parry Expire]: Deflection frames expired.");
            }
          };
          player.triggerAction(action);
        }
        break;
      }

      case "Off2":
      case "Off2Hold": {
        if (player.isOverheated) return;
        const isPowerstance = player.stance === "powerstance";
        if (!isPowerstance) {
          const action: GameplayAction = {
            id: "standard_l2",
            name: "FUSION RAILBEAM CHARGE",
            duration: 1.5,
            elapsed: 0,
            cancelable: true,
            type: "channel",
            onComplete: () => {
              player.increaseHeat(22);
              gameManager.fireHeavyFusionGatling();
            }
          };
          player.triggerAction(action);
        } else {
          const action: GameplayAction = {
            id: "powerstance_l2",
            name: "ARCANE BLADE VORTEX",
            duration: 1.8,
            elapsed: 0,
            cancelable: true,
            type: "channel",
            onComplete: () => {
              player.increaseHeat(24);
              const pos = player.getPosition();
              for (let j = 0; j < 6; j++) {
                const angle = (j / 6) * Math.PI * 2;
                const auraPt = pos.add(new Vector3(Math.cos(angle) * 4.8, 0, Math.sin(angle) * 4.8));
                gameManager.fx.spawnExplosion(auraPt, 5, 0.6);
              }
              gameManager.cameraSystem.triggerShake(0.6);
              const targets = [...gameManager.spawnedEnemies];
              targets.forEach(e => {
                if (Vector3.Distance(e.node.position, pos) < 7.2) {
                  gameManager.damageEnemy(e, 275);
                }
              });
            }
          };
          player.triggerAction(action);
        }
        break;
      }

      case "Dash": {
        const cost = 25;
        if (player.en < cost) {
          console.log("[Dash Cancel]: Low energy!");
          return;
        }
        
        if (player.currentAction) {
          if (player.currentAction.cancelable) {
            player.cancelCurrentAction();
          } else {
            console.log("[Dash Cancel]: Cannot interrupt committed stance swap!");
            return;
          }
        }
        
        const moveDir = InputManager.getInstance().getMoveDirection();
        const didDash = player.executeDash(moveDir);
        if (didDash) {
          player.en -= cost;
          gameManager.cameraSystem.triggerShake(0.85);
          gameManager.fx.spawnExplosion(player.getPosition().add(new Vector3(0, 0.25, 0)), 8, 0.4);
        }
        break;
      }

      case "Cancel": {
        if (player.currentAction) {
          if (player.currentAction.cancelable) {
            player.cancelCurrentAction();
            gameManager.fx.spawnHitImpact(player.getPosition().add(new Vector3(0, 1.2, 0)));
          } else {
            console.log("[Action Intercept]: Cannot cancel committed transition!");
          }
        } else {
          gameManager.targetingSystem.clearTargets();
          console.log("[Target Lock]: Manually cleared all locks.");
        }
        break;
      }

      default:
        break;
    }
  }

  /**
   * Reset hold blocks when buttons/keys are released
   */
  public releaseHold(signal: string): void {
    this.activeHoldFires.delete(signal);
  }
}
