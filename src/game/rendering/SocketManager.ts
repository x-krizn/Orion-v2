/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TransformNode, Mesh, Vector3, Quaternion } from "@babylonjs/core";

export class SocketManager {
  private registeredSockets: Map<string, TransformNode | Mesh> = new Map();
  private socketNamesList: string[] = [];

  constructor() {
    console.log("[SocketManager]: System initialized.");
  }

  /**
   * Resets the registry and recursively scans the subtree of the provided root node
   * for any node or mesh whose name starts with "socket_" (case-insensitive).
   */
  public discoverSockets(rootNode: TransformNode): void {
    this.registeredSockets.clear();
    this.socketNamesList = [];
    console.log(`[SocketManager]: Initiating recursive socket discovery on '${rootNode.name}'...`);
    this.scanRecursive(rootNode);
    console.log(`[SocketManager]: Successfully registered ${this.registeredSockets.size} active sockets:`, Array.from(this.registeredSockets.keys()));
  }

  /**
   * Internal recursive scanner
   */
  private scanRecursive(node: any): void {
    if (!node) return;

    if (node instanceof TransformNode || node instanceof Mesh || node.name) {
      const lowerName = node.name.toLowerCase();
      if (lowerName.startsWith("socket_")) {
        // Register in lookup using both canonical lowercase and exact name keys
        this.registeredSockets.set(lowerName, node);
        if (node.name !== lowerName) {
          this.registeredSockets.set(node.name, node);
        }
        
        // Add to deduplicated list of discovered canonical sockets
        if (!this.socketNamesList.includes(node.name)) {
          this.socketNamesList.push(node.name);
        }
        console.log(`[SocketManager]: Registered socket "${node.name}" (${node.getClassName()})`);
      }
    }

    const children = node.getChildren ? node.getChildren() : [];
    for (const child of children) {
      this.scanRecursive(child);
    }
  }

  /**
   * Retrieves a registered socket by its exact or lowercase name.
   */
  public getSocket(name: string): TransformNode | Mesh | undefined {
    return this.registeredSockets.get(name) || this.registeredSockets.get(name.toLowerCase());
  }

  /**
   * Attaches a loaded module root to a specified named socket.
   * Performs alignment, resetting local translation and rotation to zero.
   * Then scans the newly attached module subtree to discover secondary/nested sockets.
   */
  public attachModuleToSocket(moduleRoot: TransformNode, socketName: string): boolean {
    const socket = this.getSocket(socketName);
    if (!socket) {
      console.warn(`[SocketManager]: Attachment aborted. Required socket "${socketName}" was not found!`);
      return false;
    }

    console.log(`[SocketManager]: Attaching module "${moduleRoot.name}" to parent socket "${socket.name}"`);
    
    // Parent the module to the socket
    moduleRoot.parent = socket;

    // Correct alignment: Reset local position to zero
    moduleRoot.position.set(0, 0, 0);

    // Reset local rotation to zero
    if (moduleRoot.rotationQuaternion) {
      moduleRoot.rotationQuaternion = Quaternion.Identity();
    } else {
      moduleRoot.rotation.set(0, 0, 0);
    }

    // Reset scale to 1.0 to fit the socket space unless manually calibrated
    moduleRoot.scaling.set(1, 1, 1);

    // Forces immediate world matrix recalculations
    moduleRoot.computeWorldMatrix(true);

    // Recursively discover nested/child sockets inside the newly attached weapon or module.
    // E.g. finding "socket_muzzle" or "socket_fx" inside an attached wing arm.
    this.scanRecursive(moduleRoot);

    console.log(`[SocketManager]: Attachment complete. Socket inventory size is now ${this.registeredSockets.size}`);
    return true;
  }

  /**
   * Returns a list of all unique discovered socket canonical names.
   */
  public getDiscoveredSocketNames(): string[] {
    return [...this.socketNamesList];
  }

  /**
   * Checks if a socket is Port (odd numbered end/suffix match) or designated Left.
   */
  public isPort(socketName: string): boolean {
    const clean = socketName.toLowerCase();
    const match = clean.match(/_0*(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      return num % 2 !== 0; // odd numbered are Port
    }
    return clean.includes("_left") || clean.includes("_port") || clean.includes("arm_01") || clean.includes("weapon_01") || clean.includes("leg_01") || clean.includes("aux_01") || clean.includes("aux_03");
  }

  /**
   * Checks if a socket is Starboard (even numbered end/suffix match) or designated Right.
   */
  public isStarboard(socketName: string): boolean {
    const clean = socketName.toLowerCase();
    const match = clean.match(/_0*(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      return num % 2 === 0; // even numbered are Starboard
    }
    return clean.includes("_right") || clean.includes("_starboard") || clean.includes("arm_02") || clean.includes("weapon_02") || clean.includes("leg_02") || clean.includes("aux_02") || clean.includes("aux_04");
  }
}
