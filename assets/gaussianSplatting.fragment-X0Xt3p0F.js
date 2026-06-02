import{S as a,O as i,ak as r,a1 as o,am as l,a2 as s,a9 as S,Q as g}from"./index-2GKhT2C3.js";const n="gaussianSplattingPixelShader",t=`#include<clipPlaneFragmentDeclaration>
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
`;a.ShadersStoreWGSL[n]||(a.ShadersStoreWGSL[n]=t);const c=[i,r,o,l,s,S,g];for(const e of c)a.IncludesShadersStoreWGSL[e.name]||(a.IncludesShadersStoreWGSL[e.name]=e.shader);const m={name:n,shader:t};export{m as gaussianSplattingPixelShaderWGSL};
