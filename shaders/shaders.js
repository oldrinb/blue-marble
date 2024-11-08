/*<?xml version="1.0" encoding="utf-8"?>*/

/**
 * Author: Oldrin Bărbulescu
 * Last modified: Nov 7, 2024
 **/

const shaders = {
  vertexShader: `#version 300 es  
    precision highp float;

    in vec3 mPosition, mNormal, mTangent, mBitangent;
    in vec2 vTexCoord;

    out vec2 fTexCoord;
    out vec3 ePosition, eNormal, eTangent, eBitangent;

    uniform mat4 modelViewMatrix, modelViewProjMatrix, normalMatrix;



    void main() {
      gl_Position = modelViewProjMatrix * vec4(mPosition, 1.0f);
      fTexCoord = vTexCoord * vec2(1.0f, -1.0f);

      ePosition = (modelViewMatrix * vec4(mPosition, 1.0f)).xyz;
      eNormal = (normalMatrix * vec4(mNormal, 1.0f)).xyz;
      eTangent = (normalMatrix * vec4(mTangent, 1.0f)).xyz;
      eBitangent = (normalMatrix * vec4(mBitangent, 1.0f)).xyz;
    }
  `,




  fragmentShader: `#version 300 es
    precision highp float;

    const uint EARTH = 0u, CLOUDS = 1u;
    const float TRANSITION_THRES = 0.5f;
    const float EPSILON = 0.01f;

    struct MATERIAL {
      uint id;
      vec3 diffColor, emissColor, specColor;
      float shininess, opacity;
    };

    struct LIGHT {
      vec3 eDirection;
      vec3 diffColor, specColor;
    };

    in vec2 fTexCoord;
    in vec3 ePosition, eNormal, eTangent, eBitangent;

    out vec4 fragColor;

    uniform MATERIAL material;
    uniform LIGHT light;

    uniform sampler2D diffTexSampler, emissTexSampler, specNormTexSampler;
    uniform bool normalMapping;



    void computeLightParam (vec3 tNormal, out float NdotL, out float powNdotH) {
      vec3 L = -light.eDirection;
      vec3 N = normalize(eNormal);

      if (normalMapping && material.id == EARTH) {
        vec3 T = normalize (eTangent);
        vec3 B = normalize (eBitangent);
        mat3 TBN = mat3(T.x, B.x, N.x,
                        T.y, B.y, N.y,
                        T.z, B.z, N.z);
        
        NdotL = max(0.0f, dot(tNormal, TBN * L));
      }
      else NdotL = max(0.0f, dot(N, L));

      if (material.id == EARTH) {
        vec3 E = vec3(0.0f) - ePosition;
        E = (length(E) > EPSILON) ? normalize(E) : vec3(0.0f); // surface -> eye

        vec3 H = L + E;
        H = (length(H) > EPSILON) ? normalize(H) : vec3(0.0f);

        float NdotH = max(0.0f, dot(N, H));
        powNdotH = (NdotL > 0.0f && material.shininess > 0.0f) ?
            pow(NdotH, material.shininess) : 0.0f;
      }
    }



    void computeShading(vec3 tNormal,
        out vec4 color, out vec3 emissColor, out vec3 specColor) {
      float NdotL, powNdotH;
      computeLightParam(tNormal, NdotL, powNdotH);

      color = vec4
          (light.diffColor * material.diffColor * NdotL, material.opacity);

      if (material.id == EARTH) {
        emissColor = material.emissColor;
        specColor = light.specColor * material.specColor * powNdotH;

        if (NdotL < TRANSITION_THRES) {
          float t = 1.0f / TRANSITION_THRES * NdotL;
          emissColor = mix(emissColor, vec3(0.0f), t);
          specColor = mix(vec3(0.0f), specColor, t);
        }
        else emissColor = vec3(0.0f);
      }
      else {
        emissColor = vec3(0.0f);
        specColor = vec3(0.0f);
      }
    }



    void main() {
      vec4 color;
      vec3 emissColor, specColor;

      vec3 tNormal = vec3(texture(specNormTexSampler, fTexCoord).gb, 1.0f);
      tNormal = normalize (2.0f * tNormal - 1.0f);

      computeShading(tNormal, color, emissColor, specColor);

      if (material.id == EARTH) {
        color.rgb *= texture(diffTexSampler, fTexCoord).rgb;
        emissColor *= texture(emissTexSampler, fTexCoord).rgb;
        specColor *= texture(specNormTexSampler, fTexCoord).rrr;
      }
      else if (material.id == CLOUDS) {
        color *= texture(diffTexSampler, fTexCoord).rrrr;
      }

      fragColor = vec4(color.rgb + emissColor + specColor, color.a);
    }
  `
};
