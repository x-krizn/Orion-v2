import{S as e,aD as t,aB as a,ar as n,ap as i}from"./index-C9ewiXQc.js";const r="volumetricLightingRenderVolumeVertexShader",s=`#include<__decl__sceneVertex>
#include<__decl__meshVertex>
attribute vec3 position;varying vec4 vWorldPos;void main(void) {vec4 worldPos=world*vec4(position,1.0);vWorldPos=worldPos;gl_Position=viewProjection*worldPos;}
`;e.ShadersStore[r]||(e.ShadersStore[r]=s);const c=[t,a,n,i];for(const o of c)e.IncludesShadersStore[o.name]||(e.IncludesShadersStore[o.name]=o.shader);const l={name:r,shader:s};export{l as volumetricLightingRenderVolumeVertexShader};
