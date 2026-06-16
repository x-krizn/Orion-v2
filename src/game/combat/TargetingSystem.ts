/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TransformNode, Vector3, Mesh } from "@babylonjs/core";
import { CombatEntityState } from "./CombatTypes";
import { COMBAT_TUNABLES } from "./CombatConfig";

export interface TargetableEntity {
  node: TransformNode;
  data: {
    name: string;
    scale?: number;
  };
  health: number;
  maxHealth: number;
  combatState: CombatEntityState;
  lastAttackTime?: number;
}

export interface TargetLockInfo {
  enemy: TargetableEntity;
  progress: number; // 0 to 1
  losLostTime?: number; // track Line of Sight loss retention
}

export class TargetingSystem {
  private lockedTargets: TargetLockInfo[] = [];
  
  // Tuning parameters
  public lockRange: number = COMBAT_TUNABLES.defaultLockRange;
  public lockSpeed: number = COMBAT_TUNABLES.defaultLockSpeed;
  public lockCount: number = COMBAT_TUNABLES.defaultLockCount;
  public lockRetention: boolean = true;
  public autoLockEnabled: boolean = true;
  
  // Performance Throttling for Line of Sight checks on mobile/desktop
  private updateTimer: number = 0;
  private readonly scanThrottleInterval: number = 0.1; // 100ms interval for expensive raycasts
  private losCache: Map<string, boolean> = new Map();

  constructor(options?: {
    lockRange?: number;
    lockSpeed?: number;
    lockCount?: number;
    lockRetention?: boolean;
    autoLockEnabled?: boolean;
  }) {
    if (options) {
      if (options.lockRange !== undefined) this.lockRange = options.lockRange;
      if (options.lockSpeed !== undefined) this.lockSpeed = options.lockSpeed;
      if (options.lockCount !== undefined) this.lockCount = options.lockCount;
      if (options.lockRetention !== undefined) this.lockRetention = options.lockRetention;
      if (options.autoLockEnabled !== undefined) this.autoLockEnabled = options.autoLockEnabled;
    }
  }

  /**
   * Returns read-only snapshot or direct reference to locked targets
   */
  public getLockedTargets(): TargetLockInfo[] {
    return this.lockedTargets;
  }

  /**
   * Sets current locked targets directly (preserves compatibility with legacy assignments)
   */
  public setLockedTargets(targets: TargetLockInfo[]): void {
    this.lockedTargets = targets;
  }

  /**
   * Clears/Releases target
   */
  public clearTargets(): void {
    this.lockedTargets = [];
  }

  /**
   * Core update loop of TargetingSystem. Ticked from GameManager.
   * Updates Line of Sight, range retention, and acquires progress ticks.
   */
  public update(
    deltaTimeSeconds: number,
    playerPosition: Vector3,
    allEnemies: TargetableEntity[],
    obstacles: Mesh[]
  ): void {
    this.updateTimer += deltaTimeSeconds;
    const isScanTick = this.updateTimer >= this.scanThrottleInterval;
    if (isScanTick) {
      this.updateTimer = 0;
    }

    // 1. Line of Sight & Range checks on locked targets
    this.lockedTargets = this.lockedTargets.filter(lt => {
      // Release target if missing, disposed, or dead
      if (!lt.enemy || !lt.enemy.node || lt.enemy.node.isDisposed()) return false;
      if (lt.enemy.health <= 0) return false;

      // Check if target still exists in active enemies list
      const exists = allEnemies.some(e => e === lt.enemy || e.node === lt.enemy.node);
      if (!exists) return false;

      const targetPos = lt.enemy.node.position;

      // Check distance is within lockRange (only if lock retention is disabled)
      if (!this.lockRetention) {
        const dist = Vector3.Distance(playerPosition, targetPos);
        if (dist > this.lockRange) {
          console.log(`[Target Lock]: Locked target ${lt.enemy.data.name} exceeded maximum range ${this.lockRange}m`);
          return false;
        }
      }

      // Check Line of Sight (LoS) with performance throttling
      let hasLoS = true;
      const targetId = lt.enemy.node.id || "Target";
      
      if (isScanTick) {
        hasLoS = this.checkLineOfSight(playerPosition, targetPos, obstacles);
        this.losCache.set(targetId, hasLoS);
      } else {
        hasLoS = this.losCache.get(targetId) ?? true;
      }

      if (!hasLoS) {
        if (lt.losLostTime === undefined) {
          lt.losLostTime = 0;
        }
        lt.losLostTime += deltaTimeSeconds;
        if (lt.losLostTime > COMBAT_TUNABLES.defaultLockRetentionSecs) {
          console.log(`[Target Lock]: Target ${lt.enemy.data.name} lock broken due to loss of line-of-sight beyond retention window!`);
          return false;
        }
      } else {
        lt.losLostTime = 0;
      }

      // Charge up lock acquisition progress (Lock Speed stat)
      if (lt.progress < 1.0) {
        lt.progress = Math.min(1.0, lt.progress + deltaTimeSeconds * this.lockSpeed);
      }

      return true;
    });

    // 2. Auto-lock closest valid target if enabled and locks are empty
    if (this.autoLockEnabled && this.lockedTargets.length === 0 && allEnemies.length > 0) {
      this.acquireNearestValidTarget(playerPosition, allEnemies, obstacles, isScanTick);
    }
  }

  /**
   * Acquires the nearest valid target
   */
  public acquireNearestValidTarget(
    playerPosition: Vector3,
    allEnemies: TargetableEntity[],
    obstacles: Mesh[],
    bypassThrottle: boolean = true
  ): void {
    let closestEnemy: TargetableEntity | null = null;
    let closestDist = this.lockRange;

    allEnemies.forEach(enemy => {
      if (enemy.health <= 0 || enemy.node.isDisposed()) return;
      
      const targetPos = enemy.node.position;
      const dist = Vector3.Distance(playerPosition, targetPos);

      if (dist < closestDist) {
        const targetId = enemy.node.id || "Target";
        let hasLoS = true;

        if (bypassThrottle) {
          hasLoS = this.checkLineOfSight(playerPosition, targetPos, obstacles);
          this.losCache.set(targetId, hasLoS);
        } else {
          hasLoS = this.losCache.get(targetId) ?? this.checkLineOfSight(playerPosition, targetPos, obstacles);
        }

        if (hasLoS) {
          closestDist = dist;
          closestEnemy = enemy;
        }
      }
    });

    if (closestEnemy) {
      this.toggleTargetLock(closestEnemy, playerPosition);
    }
  }

  /**
   * Cycles target among all candidates
   */
  public cycleTarget(playerPosition: Vector3, allEnemies: TargetableEntity[]): void {
    const validEnemies = allEnemies.filter(e => e.health > 0 && !e.node.isDisposed());
    if (validEnemies.length <= 1) return;

    let nextIndex = 0;
    if (this.lockedTargets.length > 0) {
      const currentlyLocked = this.lockedTargets[0].enemy;
      const currentIdx = validEnemies.indexOf(currentlyLocked);
      if (currentIdx >= 0) {
        nextIndex = (currentIdx + 1) % validEnemies.length;
      }
    }

    const enemyToLock = validEnemies[nextIndex];
    this.lockedTargets = [];
    this.toggleTargetLock(enemyToLock, playerPosition);
    console.log(`[Target Cycle]: Cycled target towards ${enemyToLock.data.name}`);
  }

  /**
   * Toggles lock on a target.
   */
  public toggleTargetLock(enemy: TargetableEntity, playerPosition: Vector3): void {
    const activeLockIdx = this.lockedTargets.findIndex(lt => lt.enemy === enemy || lt.enemy.node === enemy.node);
    if (activeLockIdx >= 0) {
      this.lockedTargets.splice(activeLockIdx, 1);
      console.log(`[Target Lock]: Broke lock on enemy ${enemy.data.name}`);
      return;
    }

    const dist = Vector3.Distance(playerPosition, enemy.node.position);
    if (dist > this.lockRange) {
      console.log(`[Target Lock]: Cannot lock ${enemy.data.name}, out of range (${dist.toFixed(1)}m > ${this.lockRange}m)`);
      return;
    }

    // Respect Lock Count
    if (this.lockedTargets.length >= this.lockCount) {
      this.lockedTargets.shift();
    }

    this.lockedTargets.push({
      enemy: enemy,
      progress: 0.0 // starts acquiring
    });
    console.log(`[Target Lock]: Acquiring lock on enemy ${enemy.data.name}`);
  }

  /**
   * Core Helper: performs line of sight checks against obstacles
   */
  private checkLineOfSight(start: Vector3, end: Vector3, obstacles: Mesh[]): boolean {
    const rayDir = end.subtract(start);
    const totalDist = rayDir.length();
    rayDir.normalize();

    for (const obstacle of obstacles) {
      if (obstacle.isDisposed()) continue;
      const obsCenter = obstacle.position;
      const v = obsCenter.subtract(start);
      const projection = Vector3.Dot(v, rayDir);

      if (projection > 1.0 && projection < totalDist - 1.0) {
        const closestSegmentPt = start.add(rayDir.scale(projection));
        const radialDist = Vector3.Distance(closestSegmentPt, obsCenter);
        const obstacleRadius = 2.2; // standard cyber column radius
        if (radialDist < obstacleRadius) {
          return false;
        }
      }
    }
    return true;
  }
}
