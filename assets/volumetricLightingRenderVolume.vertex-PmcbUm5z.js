import { S as ShaderStore, a9 as sceneVertexDeclaration, a7 as sceneUboDeclaration, Y as meshVertexDeclaration, W as meshUboDeclaration } from "./index-mwJaM9cd.js";
const name = "volumetricLightingRenderVolumeVertexShader";
const shader = `#include<__decl__sceneVertex>
#include<__decl__meshVertex>
attribute vec3 position;varying vec4 vWorldPos;void main(void) {vec4 worldPos=world*vec4(position,1.0);vWorldPos=worldPos;gl_Position=viewProjection*worldPos;}
`;
if (!ShaderStore.ShadersStore[name]) {
  ShaderStore.ShadersStore[name] = shader;
}
const includes = [sceneVertexDeclaration, sceneUboDeclaration, meshVertexDeclaration, meshUboDeclaration];
for (const inc of includes) {
  if (!ShaderStore.IncludesShadersStore[inc.name]) {
    ShaderStore.IncludesShadersStore[inc.name] = inc.shader;
  }
}
const volumetricLightingRenderVolumeVertexShader = { name, shader };
export {
  volumetricLightingRenderVolumeVertexShader
};
