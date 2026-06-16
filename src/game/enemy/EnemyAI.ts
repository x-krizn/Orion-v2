/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Vector3, Color3 } from "@babylonjs/core";
import { EnemyAIState, EnemyBehaviorProfile, getBehaviorProfileForId } from "./EnemyConfig";

// Module-level static scratch vectors to avoid per-frame allocations (critical for garbage-collection performance)
const scratchDir = new Vector3();
const scratchPos = new Vector3();
const scratchRotTarget = new Vector3();

export class EnemyAIInstance {
  public state: EnemyAIState = EnemyAIState.PATROL;
  public profile: EnemyBehaviorProfile;
  public spawnPosition: Vector3;
  public patrolTarget: Vector3;
  
  public patrolTimer: number = 0;
  public cooldownTimer: number = 0;
  public recoveryTimer: number = 0;
  public aggroTimer: number = 0;

  constructor(public enemy: any) {
    this.profile = getBehaviorProfileForId(enemy.data.id);
    this.spawnPosition = enemy.node.position.clone();
    this.patrolTarget = this.spawnPosition.clone();
    this.selectRandomPatrolTarget();
    
    // Setup initial state
    this.state = EnemyAIState.PATROL;
  }

  private selectRandomPatrolTarget(): void {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * this.profile.patrolRadius;
    this.patrolTarget.set(
      this.spawnPosition.x + Math.cos(angle) * r,
      0,
      this.spawnPosition.z + Math.sin(angle) * r
    );
    this.patrolTimer = 2.0 + Math.random() * 3.5; // Wander state retention
  }

  public update(deltaTimeSeconds: number, gameManager: any): void {
    if (this.enemy.health <= 0) {
      this.state = EnemyAIState.DEAD;
      return;
    }

    const player = gameManager.player;
    if (!player) return;

    const playerPos = player.getPosition();
    const enemyPos = this.enemy.node.position;

    // Calculate distance using scratch vectors
    playerPos.subtractToRef(enemyPos, scratchDir);
    scratchDir.y = 0;
    const distToPlayer = scratchDir.length();

    // Decrement timers
    if (this.cooldownTimer > 0) this.cooldownTimer -= deltaTimeSeconds;
    if (this.recoveryTimer > 0) this.recoveryTimer -= deltaTimeSeconds;

    // State machine tick
    switch (this.state) {
      case EnemyAIState.IDLE:
        // Passive stance. React if player gets close
        if (distToPlayer <= this.profile.aggroRange) {
          this.state = EnemyAIState.AGGRO;
          this.aggroTimer = 0.4; // brief reaction freeze
        }
        break;

      case EnemyAIState.PATROL:
        // Slow pacing around spawn point
        if (distToPlayer <= this.profile.aggroRange) {
          this.state = EnemyAIState.AGGRO;
          this.aggroTimer = 0.4;
          return;
        }

        this.patrolTimer -= deltaTimeSeconds;
        
        enemyPos.subtractToRef(this.patrolTarget, scratchRotTarget);
        scratchRotTarget.y = 0;
        const distToPatrol = scratchRotTarget.length();

        if (distToPatrol < 1.0 || this.patrolTimer <= 0) {
          this.selectRandomPatrolTarget();
        } else {
          // Move slowly towards patrol target
          scratchRotTarget.normalize();
          // We reverse direction subtracting (patrolTarget - enemyPos) is correct
          this.patrolTarget.subtractToRef(enemyPos, scratchRotTarget);
          scratchRotTarget.y = 0;
          scratchRotTarget.normalize();

          // Apply rotation
          const targetRotY = Math.atan2(scratchRotTarget.x, scratchRotTarget.z);
          this.smoothRotateTowards(targetRotY, deltaTimeSeconds * 2.0);

          // Apply slow patrol translation
          const moveSpeed = (this.enemy.data.speed || 3.0) * this.profile.patrolSpeedMult;
          enemyPos.addInPlace(scratchRotTarget.scale(deltaTimeSeconds * moveSpeed));
        }
        break;

      case EnemyAIState.AGGRO:
        // Turn to face player immediately, pause briefly (alert phase)
        if (distToPlayer > this.profile.deaggroRange) {
          this.state = EnemyAIState.PATROL;
          return;
        }

        scratchDir.normalize();
        const aggroRotY = Math.atan2(scratchDir.x, scratchDir.z);
        this.smoothRotateTowards(aggroRotY, deltaTimeSeconds * 8.0);

        this.aggroTimer -= deltaTimeSeconds;
        if (this.aggroTimer <= 0) {
          this.state = EnemyAIState.CHASE;
        }
        break;

      case EnemyAIState.CHASE:
        // Active rapid pursuit
        if (distToPlayer > this.profile.deaggroRange) {
          this.state = EnemyAIState.PATROL;
          this.spawnPosition.copyFrom(enemyPos); // Reposition patrol center
          return;
        }

        scratchDir.normalize();
        const chaseRotY = Math.atan2(scratchDir.x, scratchDir.z);
        this.smoothRotateTowards(chaseRotY, deltaTimeSeconds * 5.0);

        if (distToPlayer <= this.profile.attackRange) {
          if (this.cooldownTimer <= 0) {
            this.state = EnemyAIState.ATTACK;
          } else {
            this.state = EnemyAIState.RECOVERY;
            this.recoveryTimer = 0.2;
          }
        } else {
          const moveSpeed = (this.enemy.data.speed || 3.0) * this.profile.chaseSpeedMult;
          enemyPos.addInPlace(scratchDir.scale(deltaTimeSeconds * moveSpeed));
        }
        break;

      case EnemyAIState.ATTACK:
        // Perform swing or projectile trigger
        scratchDir.normalize();
        const attackRotY = Math.atan2(scratchDir.x, scratchDir.z);
        this.smoothRotateTowards(attackRotY, deltaTimeSeconds * 12.0);

        this.executeAttack(gameManager, playerPos);
        break;

      case EnemyAIState.RECOVERY:
        // Passive pause post-stiff combat swing
        scratchDir.normalize();
        const recRotY = Math.atan2(scratchDir.x, scratchDir.z);
        this.smoothRotateTowards(recRotY, deltaTimeSeconds * 3.0);

        if (this.recoveryTimer <= 0) {
          this.state = EnemyAIState.CHASE;
        }
        break;

      case EnemyAIState.DEAD:
        // Handled by standard cleanups
        break;
    }

    // Gentle hover bounce calculations
    this.applyHoverBounce(deltaTimeSeconds);
  }

  private smoothRotateTowards(targetRotY: number, speed: number): void {
    const diffY = targetRotY - this.enemy.node.rotation.y;
    const wrapped = Math.atan2(Math.sin(diffY), Math.cos(diffY));
    this.enemy.node.rotation.y += wrapped * speed;
  }

  private executeAttack(gameManager: any, playerPos: Vector3): void {
    const player = gameManager.player;
    if (!player) return;

    // Apply baseline damage stats
    const damage = this.enemy.data.damage || 15;
    player.takeDamage(damage);

    // Dynamic camera shakes and immersive audio visual splash effects based on profile
    const id = this.profile.enemyId;
    if (id === "orc_raider") {
      gameManager.cameraSystem.triggerShake(0.5);
      gameManager.fx.spawnExplosion(playerPos.add(new Vector3(0, 0.4, 0)), 5, 0.35);
    } else if (id === "bog_hound") {
      gameManager.cameraSystem.triggerShake(0.3);
      gameManager.fx.spawnExplosion(playerPos, 4, 0.22);
    } else if (id === "wurmling") {
      gameManager.cameraSystem.triggerShake(0.4);
      // Spawn acidic green spray around player
      gameManager.fx.spawnExplosion(playerPos.add(new Vector3(0, 0.6, 0)), 6, 0.45);
    } else if (id === "wurm_boss") {
      gameManager.cameraSystem.triggerShake(1.15);
      // Colossal screen shaking toxic eruptions
      gameManager.fx.spawnExplosion(playerPos, 12, 1.1);
    } else {
      // Standard mechanical robots fallback
      gameManager.cameraSystem.triggerShake(0.4);
      gameManager.fx.spawnExplosion(playerPos.add(new Vector3(0, 0.5, 0)), 4, 0.3);
    }

    // Set recovery and cooldown states
    this.cooldownTimer = this.profile.attackCooldown;
    this.recoveryTimer = this.profile.recoveryDuration;
    this.state = EnemyAIState.RECOVERY;
  }

  private applyHoverBounce(deltaTimeSeconds: number): void {
    const scale = this.enemy.data?.scale || 1.0;
    const hoverCycle = (performance.now() / 1000.0) * 3.0 + this.enemy.node.position.x * 2.0;
    const yOffset = Math.sin(hoverCycle) * 0.12 * scale;
    
    // Safety check on meshes
    if (!this.enemy.node.isDisposed()) {
      const children = this.enemy.node.getChildMeshes();
      children.forEach((mesh: any) => {
        if (mesh.name.includes("Body")) {
          mesh.position.y = ((1.6 * scale) / 2) + yOffset;
        } else if (mesh.name.includes("Eye")) {
          mesh.position.y = (1.2 * scale) + yOffset;
        }
      });
    }
  }
}

export class EnemyAISystem {
  private instances: Map<any, EnemyAIInstance> = new Map();

  /**
   * Ticks behavior for all active enemies, lazily registering them when spawned
   */
  public update(deltaTimeSeconds: number, gameManager: any): void {
    const spawned = gameManager.spawnedEnemies || [];

    // Clear removed enemies
    for (const key of this.instances.keys()) {
      if (!spawned.includes(key)) {
        this.instances.delete(key);
      }
    }

    // Lazily instantiate AI behaviors
    spawned.forEach((enemy: any) => {
      if (!this.instances.has(enemy)) {
        this.instances.set(enemy, new EnemyAIInstance(enemy));
      }
    });

    // Update active instances
    this.instances.forEach((instance) => {
      instance.update(deltaTimeSeconds, gameManager);
    });
  }

  /**
   * Wipe state cache entirely (useful for resets or checkpoint transitions)
   */
  public clear(): void {
    this.instances.clear();
  }
}
