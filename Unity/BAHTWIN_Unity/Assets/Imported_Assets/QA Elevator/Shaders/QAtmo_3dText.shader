Shader "QAtmo/URP_3dText"
{
    Properties
    {
        _Font("Font", 2D) = "white" {}
        _EmissionIntensity("Emission Intensity", Float) = 1
        _MaskClipValue("Mask Clip Value", Float) = 0.5
    }

    SubShader
    {
        Tags 
        { 
            "RenderType"="TransparentCutout" 
            "Queue"="AlphaTest"
        }

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode"="UniversalForward" }

            Blend One Zero
            Cull Back
            ZWrite On
            AlphaToMask On

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fog

            // URP Core includes
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            sampler2D _Font;
            float4 _Font_ST;
            float _EmissionIntensity;
            float _MaskClipValue;

            struct Attributes
            {
                float4 positionOS : POSITION;
                float2 uv         : TEXCOORD0;
                float4 color      : COLOR;
            };

            struct Varyings
            {
                float4 positionHCS : SV_POSITION;
                float2 uv          : TEXCOORD0;
                float4 color       : COLOR;
            };

            Varyings vert (Attributes input)
            {
                Varyings output;
                output.positionHCS = TransformObjectToHClip(input.positionOS.xyz);
                output.uv = TRANSFORM_TEX(input.uv, _Font);
                output.color = input.color;
                return output;
            }

            half4 frag (Varyings input) : SV_Target
            {
                half alphaTex = tex2D(_Font, input.uv).a;
                half finalAlpha = input.color.a * alphaTex;

                // cutout
                clip(finalAlpha - _MaskClipValue);

                half3 albedo = input.color.rgb;
                half3 emission = input.color.rgb * _EmissionIntensity;

                return half4(albedo + emission, finalAlpha);
            }
            ENDHLSL
        }
    }
}
