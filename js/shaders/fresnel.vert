// Fresnel rim-light vertex shader
// Passes the world-space normal and view direction to the fragment shader
// so we can compute a view-dependent edge falloff.

varying vec3 vWorldNormal;
varying vec3 vViewDir;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir     = normalize(cameraPosition - worldPos.xyz);
  gl_Position  = projectionMatrix * viewMatrix * worldPos;
}
