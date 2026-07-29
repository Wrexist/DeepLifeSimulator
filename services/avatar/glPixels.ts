/**
 * Getting at the pixels of a photograph from JavaScript.
 *
 * React Native has no image decoder reachable from JS — no canvas, no
 * `getImageData`, no way to turn a `file://` JPEG into bytes. The GPU does have
 * a decoder, so this opens a HEADLESS GL context, uploads the photo as a
 * texture, draws it into an offscreen framebuffer at the size we want and reads
 * that back. Downsampling on the GPU is exactly the box filter we would
 * otherwise have to write.
 *
 * Extracted from `onDeviceProvider` so the portrait cut-out can share it rather
 * than opening a second context and decoding the same photo twice.
 *
 * ## Row order
 *
 * `readPixels` returns rows from the BOTTOM of the framebuffer up. This flips
 * the image on the way in so the buffer that comes back is in ordinary image
 * order, top row first — because every consumer of it (the landmark scan, the
 * cut-out, the region averages) thinks in image coordinates, and a buffer that
 * is secretly upside down produces confident nonsense rather than an error. It
 * fed `scanFaceLandmarks` an inverted face until this was pulled out here.
 */

import { logger } from '@/utils/logger';

/** Lazy native-module load, cached so the try/catch runs at most once. */
let glModule: typeof import('expo-gl') | null | undefined;
export function loadGl(): typeof import('expo-gl') | null {
  if (glModule !== undefined) return glModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    glModule = require('expo-gl') as typeof import('expo-gl');
  } catch {
    glModule = null;
  }
  return glModule;
}

/** True when a photo can be decoded on this device at all. */
export function canReadPixels(): boolean {
  return typeof loadGl()?.GLView?.createContextAsync === 'function';
}

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  // The texture arrives with its origin at the top-left and GL samples from the
  // bottom-left; readPixels then returns rows bottom-up. Sampling v straight
  // through therefore cancels both flips and lands the image the right way up
  // in the returned buffer.
  vUv = vec2(aPos.x * 0.5 + 0.5, aPos.y * 0.5 + 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
void main() { gl_FragColor = texture2D(uTex, vUv); }`;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('createShader failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'shader compile failed');
  }
  return shader;
}

/**
 * Decode a photo into RGBA bytes at `width` x `height`, top row first.
 *
 * Throws when GL is unavailable or the decode fails; every caller is on a path
 * that must degrade rather than crash, so they catch.
 */
export async function readPhotoPixels(
  uri: string,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const glLib = loadGl();
  if (!glLib) throw new Error('expo-gl unavailable');
  const gl = (await glLib.GLView.createContextAsync()) as unknown as WebGLRenderingContext;

  const program = gl.createProgram();
  if (!program) throw new Error('createProgram failed');
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  gl.useProgram(program);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // expo-gl accepts an object with `localUri` here and decodes natively. Linear
  // filtering plus CLAMP_TO_EDGE because the photo is not a power of two and
  // mipmapping a NPOT texture renders black on GLES 2.
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    { localUri: uri } as unknown as TexImageSource,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const target = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, target);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error('framebuffer incomplete');
  }

  gl.viewport(0, 0, width, height);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(gl.getUniformLocation(program, 'uTex'), 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  gl.deleteFramebuffer(fbo);
  gl.deleteTexture(texture);
  gl.deleteTexture(target);
  gl.deleteBuffer(quad);
  gl.deleteProgram(program);
  try {
    await glLib.GLView.destroyContextAsync(gl as never);
  } catch (err) {
    // A context that outlives its use is a native resource leak, and a handful
    // of them is a crash rather than a slowdown. Not fatal to the decode we
    // just completed, though, so it is logged and not thrown.
    logger.warn('[glPixels] could not destroy GL context', { error: String(err) });
  }
  return pixels;
}

/**
 * Decode at a bounded long edge, keeping the photo's aspect ratio.
 *
 * Squashing a 3:4 photo into a square is fine for averaging a region's colour
 * and wrong for anything geometric: a cut-out framed in the squashed image is
 * framed on a distorted head, and the head comes out stretched.
 */
export async function readPhotoAtLongEdge(
  uri: string,
  photoWidth: number,
  photoHeight: number,
  longEdge: number,
): Promise<{ pixels: Uint8Array; width: number; height: number }> {
  const w = photoWidth > 0 ? photoWidth : longEdge;
  const h = photoHeight > 0 ? photoHeight : longEdge;
  const scale = longEdge / Math.max(w, h);
  const width = Math.max(64, Math.round(w * scale));
  const height = Math.max(64, Math.round(h * scale));
  return { pixels: await readPhotoPixels(uri, width, height), width, height };
}
