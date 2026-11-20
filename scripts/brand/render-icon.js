const { chromium } = require('playwright'); const fs = require('fs');
const [, , src, out, sizeArg] = process.argv; const N = +(sizeArg || 1024), SS = 2;
const frag = fs.readFileSync(src, 'utf8');
const html = `<canvas id=c width=${N*SS} height=${N*SS}></canvas><script>
const c=document.getElementById('c'),gl=c.getContext('webgl2',{preserveDrawingBuffer:true});
const vs='#version 300 es\\nin vec2 p;void main(){gl_Position=vec4(p,0,1);}';
const fs='#version 300 es\\nprecision highp float;precision highp int;uniform vec3 iResolution;uniform float iTime;uniform int iFrame;uniform sampler2D iChannel0;out vec4 o;\\n'+${JSON.stringify(frag)}+'\\nvoid main(){mainImage(o,gl_FragCoord.xy);}';
function sh(t,s){const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(x);return x;}
const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,vs));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(pr);gl.useProgram(pr);
const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
const l=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,2,gl.FLOAT,false,0,0);
gl.uniform3f(gl.getUniformLocation(pr,'iResolution'),c.width,c.height,1);gl.uniform1f(gl.getUniformLocation(pr,'iTime'),4.0);
gl.viewport(0,0,c.width,c.height);
const F=gl.getUniformLocation(pr,'iFrame');
const d=document.createElement('canvas');d.width=d.height=${N};const x=d.getContext('2d');x.imageSmoothingQuality='high';
const e=document.createElement('canvas');e.width=e.height=${N};const y=e.getContext('2d');y.imageSmoothingQuality='high';
gl.uniform1i(F,1);gl.drawArrays(gl.TRIANGLES,0,3);gl.finish();y.drawImage(c,0,0,${N},${N});
gl.uniform1i(F,0);gl.drawArrays(gl.TRIANGLES,0,3);gl.finish();x.drawImage(c,0,0,${N},${N});
x.globalCompositeOperation='lighter';
x.filter='brightness(0.55) contrast(3) blur('+(${N}*0.012)+'px)';x.globalAlpha=0.7;x.drawImage(e,0,0);
x.filter='brightness(0.55) contrast(3) blur('+(${N}*0.05)+'px)';x.globalAlpha=0.6;x.drawImage(e,0,0);
window.OUT=d.toDataURL('image/png');</script>`;
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage();
p.on('pageerror',e=>console.log('ERR',e.message));p.on('console',m=>console.log(m.text()));
await p.setContent(html);await p.waitForFunction('window.OUT',null,{timeout:300000});
fs.writeFileSync(out,Buffer.from((await p.evaluate('OUT')).split(',')[1],'base64'));await b.close();})();
