export const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

export const FRAGMENT_SHADER_SOURCE = `
  precision mediump float;

  varying vec2 v_texCoord;

  uniform sampler2D u_image;

  uniform sampler2D u_curve_tex_0;
  uniform sampler2D u_curve_tex_1;
  uniform sampler2D u_curve_tex_2;
  uniform sampler2D u_curve_tex_3;
  uniform sampler2D u_curve_tex_4;
  uniform sampler2D u_curve_tex_5;

  uniform float u_dce_strength;
  uniform float u_brightness;
  uniform float u_contrast;
  uniform float u_saturation;

  vec3 applyZeroDCEIteration(vec3 x, vec3 a) {
      return x + a * x * (1.0 - x);
  }

  void main() {
      vec4 originalColor = texture2D(u_image, v_texCoord);
      vec3 rgb = originalColor.rgb;

      vec4 c0 = texture2D(u_curve_tex_0, v_texCoord);
      vec4 c1 = texture2D(u_curve_tex_1, v_texCoord);
      vec4 c2 = texture2D(u_curve_tex_2, v_texCoord);
      vec4 c3 = texture2D(u_curve_tex_3, v_texCoord);
      vec4 c4 = texture2D(u_curve_tex_4, v_texCoord);
      vec4 c5 = texture2D(u_curve_tex_5, v_texCoord);

      vec3 enhancedRgb = rgb;
      enhancedRgb = applyZeroDCEIteration(enhancedRgb, c0.rgb);
      enhancedRgb = applyZeroDCEIteration(enhancedRgb, vec3(c0.a, c1.r, c1.g));
      enhancedRgb = applyZeroDCEIteration(enhancedRgb, vec3(c1.b, c1.a, c2.r));
      enhancedRgb = applyZeroDCEIteration(enhancedRgb, vec3(c2.g, c2.b, c2.a));

      rgb = mix(rgb, enhancedRgb, u_dce_strength);
      rgb += u_brightness;
      rgb = (rgb - 0.5) * u_contrast + 0.5;

      float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
      rgb = mix(vec3(luma), rgb, u_saturation);

      gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), originalColor.a);
  }
`;