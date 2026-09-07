// Stylized sea for URP: layered sine ripples, fresnel, sun glint, shore foam ring, fog.
Shader "Numera/Water"
{
    Properties
    {
        _DeepColor ("Deep", Color) = (0.25,0.61,0.78,1)
        _ShallowColor ("Shallow", Color) = (0.56,0.85,0.91,1)
        _FoamColor ("Foam", Color) = (1,1,1,1)
        _IsleRadius ("Isle Radius", Float) = 9.4
        _WaveScale ("Wave Scale", Float) = 0.9
        _WaveSpeed ("Wave Speed", Float) = 1.0
        _Glint ("Sun Glint", Range(0,2)) = 0.9
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" "Queue"="Geometry" }
        Pass
        {
            Tags { "LightMode"="UniversalForward" }
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fog
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            CBUFFER_START(UnityPerMaterial)
                half4 _DeepColor, _ShallowColor, _FoamColor; float _IsleRadius, _WaveScale, _WaveSpeed; half _Glint;
            CBUFFER_END
            struct Attributes { float4 positionOS : POSITION; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 positionWS : TEXCOORD0; float fogFactor : TEXCOORD1; };
            Varyings vert(Attributes v)
            {
                Varyings o; VertexPositionInputs p = GetVertexPositionInputs(v.positionOS.xyz);
                o.positionCS = p.positionCS; o.positionWS = p.positionWS; o.fogFactor = ComputeFogFactor(p.positionCS.z); return o;
            }
            half4 frag(Varyings i) : SV_Target
            {
                float3 p = i.positionWS; float t = _Time.y * _WaveSpeed;
                float a = p.x * _WaveScale + t * 1.1, b = p.z * _WaveScale * 1.4 - t * 0.8, c = (p.x + p.z) * _WaveScale * 0.5 + t * 0.5;
                float w = sin(a) * 0.5 + sin(b) * 0.35 + sin(c) * 0.5;
                float3 n = normalize(float3(-cos(a) * 0.28 - cos(c) * 0.1, 1.0, -cos(b) * 0.25 - cos(c) * 0.1));
                float3 V = normalize(GetWorldSpaceViewDir(p));
                Light L = GetMainLight();
                half fres = pow(1.0 - saturate(dot(n, V)), 3.0);
                half spec = pow(saturate(dot(reflect(-L.direction, n), V)), 90.0) * _Glint;
                float d = length(p.xz);
                half foam = smoothstep(_IsleRadius + 1.6, _IsleRadius + 0.2, d) * (0.55 + 0.45 * sin(d * 5.0 - t * 2.2 + w));
                half3 col = lerp(_DeepColor.rgb, _ShallowColor.rgb, saturate(fres * 0.8 + w * 0.12 + 0.15));
                col += spec * L.color + foam * _FoamColor.rgb * 0.55;
                col = MixFog(col, i.fogFactor);
                return half4(col, 1);
            }
            ENDHLSL
        }
    }
}
