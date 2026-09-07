// Three-stop gradient skybox driven by DayNightCycle.
Shader "Numera/Sky Gradient"
{
    Properties { _Top ("Top", Color) = (0.25,0.56,0.88,1) _Mid ("Horizon", Color) = (0.66,0.84,0.96,1) _Bottom ("Below", Color) = (0.85,0.92,0.96,1) }
    SubShader
    {
        Tags { "Queue"="Background" "RenderType"="Background" "PreviewType"="Skybox" }
        Cull Off ZWrite Off
        Pass
        {
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            half4 _Top, _Mid, _Bottom;
            struct Attributes { float4 positionOS : POSITION; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 dir : TEXCOORD0; };
            Varyings vert(Attributes v) { Varyings o; o.positionCS = TransformObjectToHClip(v.positionOS.xyz); o.dir = v.positionOS.xyz; return o; }
            half4 frag(Varyings i) : SV_Target
            {
                float h = normalize(i.dir).y; float t = clamp(h, -0.05, 1.0);
                half3 c = t < 0.22 ? lerp(_Bottom.rgb, _Mid.rgb, t / 0.22) : lerp(_Mid.rgb, _Top.rgb, pow((t - 0.22) / 0.78, 0.8));
                return half4(c, 1);
            }
            ENDHLSL
        }
    }
}
