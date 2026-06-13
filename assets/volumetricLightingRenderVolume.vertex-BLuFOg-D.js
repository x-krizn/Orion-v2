import { S as ShaderStore, a8 as sceneUboDeclarationWGSL, X as meshUboDeclarationWGSL } from "./index-mwJaM9cd.js";
const name = "volumetricLightingRenderVolumeVertexShader";
const shader = `#include<sceneUboDeclaration>
#include<meshUboDeclaration>
attribute position : vec3f;varying vWorldPos: vec4f;@vertex
fn main(input : VertexInputs)->FragmentInputs {let worldPos=mesh.world*vec4f(vertexInputs.position,1.0);vertexOutputs.vWorldPos=worldPos;vertexOutputs.position=scene.viewProjection*worldPos;}
`;
if (!ShaderStore.ShadersStoreWGSL[name]) {
  ShaderStore.ShadersStoreWGSL[name] = shader;
}
const includes = [sceneUboDeclarationWGSL, meshUboDeclarationWGSL];
for (const inc of includes) {
  if (!ShaderStore.IncludesShadersStoreWGSL[inc.name]) {
    ShaderStore.IncludesShadersStoreWGSL[inc.name] = inc.shader;
  }
}
const volumetricLightingRenderVolumeVertexShaderWGSL = { name, shader };
export {
  volumetricLightingRenderVolumeVertexShaderWGSL
};
