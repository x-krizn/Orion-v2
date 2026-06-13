import { S as ShaderStore, n as clipPlaneFragmentDeclarationWGSL, P as logDepthDeclarationWGSL, v as fogFragmentDeclarationWGSL, T as logDepthFragmentWGSL, w as fogFragmentWGSL, D as gaussianSplattingFragmentDeclarationWGSL, o as clipPlaneFragmentWGSL } from "./index-mwJaM9cd.js";
const name = "gaussianSplattingPixelShader";
const shader = `#include<clipPlaneFragmentDeclaration>
#include<logDepthDeclaration>
#include<fogFragmentDeclaration>
varying vColor: vec4f;varying vPosition: vec2f;
#define CUSTOM_FRAGMENT_DEFINITIONS
#include<gaussianSplattingFragmentDeclaration>
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<clipPlaneFragment>
var finalColor: vec4f=gaussianColor(input.vColor,input.vPosition);
#define CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR
fragmentOutputs.color=finalColor;
#define CUSTOM_FRAGMENT_MAIN_END
}
`;
if (!ShaderStore.ShadersStoreWGSL[name]) {
  ShaderStore.ShadersStoreWGSL[name] = shader;
}
const includes = [clipPlaneFragmentDeclarationWGSL, logDepthDeclarationWGSL, fogFragmentDeclarationWGSL, logDepthFragmentWGSL, fogFragmentWGSL, gaussianSplattingFragmentDeclarationWGSL, clipPlaneFragmentWGSL];
for (const inc of includes) {
  if (!ShaderStore.IncludesShadersStoreWGSL[inc.name]) {
    ShaderStore.IncludesShadersStoreWGSL[inc.name] = inc.shader;
  }
}
const gaussianSplattingPixelShaderWGSL = { name, shader };
export {
  gaussianSplattingPixelShaderWGSL
};
