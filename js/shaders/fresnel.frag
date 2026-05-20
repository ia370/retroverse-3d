// Fresnel rim-light fragment shader
// Adds a colour fringe at grazing angles — a classic effect for
// product visualisation. Cheap to compute, very high visual impact.

uniform vec3  uBaseColor;
uniform vec3  uRimColor;
uniform float uRimPower;     // edge sharpness, sensible range 1.0 – 6.0
uniform float uRimStrength;  // overall intensity, 0.0 – 2.0

varying vec3 vWorldNormal;
varying vec3 vViewDir;

void main() {
  vec3  N = normalize(vWorldNormal);
  vec3  V = normalize(vViewDir);
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), uRimPower);
  vec3  color   = uBaseColor + uRimColor * fresnel * uRimStrength;
  gl_FragColor  = vec4(color, 1.0);
}
