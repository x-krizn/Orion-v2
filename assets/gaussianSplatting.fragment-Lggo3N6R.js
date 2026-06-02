import{S as a,N as r,aj as o,a0 as l,al as t,$ as s,a8 as c,M as g}from"./index-yncEMCOQ.js";const n="gaussianSplattingPixelShader",i=`#include<clipPlaneFragmentDeclaration>
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
`;a.ShadersStore[n]||(a.ShadersStore[n]=i);const d=[r,o,l,t,s,c,g];for(const e of d)a.IncludesShadersStore[e.name]||(a.IncludesShadersStore[e.name]=e.shader);const F={name:n,shader:i};export{F as gaussianSplattingPixelShader};
