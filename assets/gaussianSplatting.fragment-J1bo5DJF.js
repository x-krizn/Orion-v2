import { S as ShaderStore, m as clipPlaneFragmentDeclaration, O as logDepthDeclaration, u as fogFragmentDeclaration, Q as logDepthFragment, t as fogFragment, C as gaussianSplattingFragmentDeclaration, l as clipPlaneFragment } from "./index-mwJaM9cd.js";
const name = "gaussianSplattingPixelShader";
const shader = `#include<clipPlaneFragmentDeclaration>
#include<logDepthDeclaration>
#include<fogFragmentDeclaration>
varying vec4 vColor;varying vec2 vPosition;
#define CUSTOM_FRAGMENT_DEFINITIONS
#include<gaussianSplattingFragmentDeclaration>
void main () {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<clipPlaneFragment>
vec4 finalColor=gaussianColor(vColor);
#define CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR
gl_FragColor=finalColor;
#define CUSTOM_FRAGMENT_MAIN_END
}
`;
if (!ShaderStore.ShadersStore[name]) {
  ShaderStore.ShadersStore[name] = shader;
}
const includes = [clipPlaneFragmentDeclaration, logDepthDeclaration, fogFragmentDeclaration, logDepthFragment, fogFragment, gaussianSplattingFragmentDeclaration, clipPlaneFragment];
for (const inc of includes) {
  if (!ShaderStore.IncludesShadersStore[inc.name]) {
    ShaderStore.IncludesShadersStore[inc.name] = inc.shader;
  }
}
const gaussianSplattingPixelShader = { name, shader };
export {
  gaussianSplattingPixelShader
};
