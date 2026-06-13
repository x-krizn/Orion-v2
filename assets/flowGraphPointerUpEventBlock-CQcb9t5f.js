import { a as FlowGraphEventBlock, b as RichTypeAny, c as RichTypeNumber, _ as _IsDescendantOf, R as RegisterClass } from "./index-mwJaM9cd.js";
class FlowGraphPointerUpEventBlock extends FlowGraphEventBlock {
  /**
   * Creates a new FlowGraphPointerUpEventBlock.
   * @param config optional configuration
   */
  constructor(config) {
    super(config);
    this.type = "PointerUp";
    this.targetMesh = this.registerDataInput("targetMesh", RichTypeAny, config == null ? void 0 : config.targetMesh);
    this.pointerId = this.registerDataOutput("pointerId", RichTypeNumber);
    this.pickedMesh = this.registerDataOutput("pickedMesh", RichTypeAny);
    this.pickedPoint = this.registerDataOutput("pickedPoint", RichTypeAny);
  }
  /** @internal */
  _executeEvent(context, pointerInfo) {
    var _a, _b, _c;
    const mesh = this.targetMesh.getValue(context);
    const pickedMesh = (_a = pointerInfo.pickInfo) == null ? void 0 : _a.pickedMesh;
    if (mesh && !(pickedMesh === mesh || pickedMesh && _IsDescendantOf(pickedMesh, mesh))) {
      return true;
    }
    this.pointerId.setValue(pointerInfo.event.pointerId, context);
    this.pickedMesh.setValue(pickedMesh ?? null, context);
    this.pickedPoint.setValue(((_b = pointerInfo.pickInfo) == null ? void 0 : _b.pickedPoint) ?? null, context);
    this._execute(context);
    return !((_c = this.config) == null ? void 0 : _c.stopPropagation);
  }
  /** @internal */
  _preparePendingTasks(_context) {
  }
  /** @internal */
  _cancelPendingTasks(_context) {
  }
  /**
   * @returns the class name of the block.
   */
  getClassName() {
    return "FlowGraphPointerUpEventBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphPointerUpEventBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphPointerUpEventBlock", FlowGraphPointerUpEventBlock);
}
RegisterFlowGraphPointerUpEventBlock();
export {
  FlowGraphPointerUpEventBlock,
  RegisterFlowGraphPointerUpEventBlock
};
