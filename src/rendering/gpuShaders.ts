// Geometry stays in local world coordinates. Camera motion changes uniforms,
// not the segment buffers. Six vertices per instance form a capsule's bounds.
export const GPU_SEGMENT_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec4 a_segment;
uniform vec2 u_camera;
uniform vec2 u_size;
uniform vec2 u_view;
uniform float u_scale;
uniform float u_radius;
out vec2 v_local;
flat out float v_length;
vec2 project(vec2 p) {
  vec2 d = p - u_camera;
  return vec2(u_view.x * 0.5, u_size.y - u_view.y * 0.5)
    + d * u_scale * vec2(1.0, -1.0);
}
void main() {
  vec2 a = project(a_segment.xy);
  vec2 b = project(a_segment.zw);
  vec2 delta = b - a;
  float len = length(delta);
  vec2 direction = len > 0.0 ? delta / len : vec2(1.0, 0.0);
  vec2 normal = vec2(-direction.y, direction.x);
  int corners[6] = int[6](0, 1, 2, 2, 1, 3);
  int corner = corners[gl_VertexID];
  float pad = u_radius + 0.5;
  v_local = vec2((corner & 1) == 0 ? -pad : len + pad,
                 (corner & 2) == 0 ? -pad : pad);
  v_length = len;
  vec2 position = a + direction * v_local.x + normal * v_local.y;
  gl_Position = vec4(position / u_size * 2.0 - 1.0, 0.0, 1.0);
}`;

export const GPU_SEGMENT_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_local;
flat in float v_length;
uniform float u_radius;
out vec4 outColor;
void main() {
  vec2 closest = vec2(clamp(v_local.x, 0.0, v_length), 0.0);
  float distance = length(v_local - closest);
  // A subpixel stroke has two edges in the same pixel. Subtract the opposite
  // edge's ramp so a narrow straight body retains its actual width/brightness.
  float coverage = clamp(u_radius + 0.5 - distance, 0.0, 1.0)
    - clamp(0.5 - u_radius - distance, 0.0, 1.0);
  outColor = vec4(coverage, 0.0, 0.0, 1.0);
}`;

export const GPU_REAR_FRAGMENT = `#version 300 es
precision highp float;
uniform highp sampler2D u_rear;
out vec4 outColor;
void main() {
  outColor = texelFetch(u_rear, ivec2(gl_FragCoord.xy), 0);
}`;

export const GPU_COMPOSITE_VERTEX = `#version 300 es
precision highp float;
void main() {
  vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`;

export const GPU_COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D u_coverage;
uniform vec2 u_size;
uniform vec4 u_ink;
out vec4 outColor;
void main() {
  float coverageByte = floor(texture(u_coverage, gl_FragCoord.xy / u_size).r * 255.0 + 0.5);
  float alphaByte = floor(u_ink.a * 255.0 + 0.5);
  vec3 premultiplied = floor(u_ink.rgb * alphaByte + 0.5);
  float coverageScale = coverageByte + 1.0;
  alphaByte = floor(alphaByte * coverageScale / 256.0);
  premultiplied = floor(premultiplied * coverageScale / 256.0);
  if (alphaByte == 0.0) { discard; }
  outColor = vec4((premultiplied - 0.499) / 255.0, alphaByte / 256.0);
}`;

// Stars retain immutable local world coordinates. Camera movement only changes uniforms.
// Round in the virtual CSS viewport before applying the scan zoom, like the native painter.
export const GPU_STAR_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_star;
uniform vec2 u_camera;
uniform vec2 u_size;
uniform vec2 u_view;
uniform float u_scale;
uniform float u_zoom;
uniform float u_dpr;
uniform float u_starSize;
flat out vec4 v_rect;
flat out float v_alpha;
void main() {
  vec2 virtualCenter = u_view / (2.0 * u_zoom * u_dpr);
  vec2 cssPosition = virtualCenter + (a_star.xy - u_camera) * u_scale;
  vec2 rounded = trunc(cssPosition + vec2(0.5));
  vec2 topLeft = (u_view * 0.5) + (rounded - virtualCenter) * u_zoom * u_dpr;
  v_rect = vec4(topLeft, topLeft + vec2(u_starSize * u_zoom * u_dpr));
  v_alpha = a_star.z;
  int corners[6] = int[6](0, 1, 2, 2, 1, 3);
  int corner = corners[gl_VertexID];
  vec2 point = vec2((corner & 1) == 0 ? floor(v_rect.x) : ceil(v_rect.z),
                    (corner & 2) == 0 ? floor(v_rect.y) : ceil(v_rect.w));
  gl_Position = vec4(point / u_size * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0);
}`;

export const GPU_STAR_FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 u_size;
uniform vec3 u_ink;
flat in vec4 v_rect;
flat in float v_alpha;
out vec4 outColor;
void main() {
  vec2 point = vec2(gl_FragCoord.x, u_size.y - gl_FragCoord.y);
  vec2 coverage = max(vec2(0.0), min(v_rect.zw, point + 0.5) - max(v_rect.xy, point - 0.5));
  float alpha = coverage.x * coverage.y * v_alpha;
  outColor = vec4(u_ink * alpha, alpha);
}`;
