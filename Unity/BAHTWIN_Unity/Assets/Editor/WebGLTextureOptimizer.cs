using UnityEditor;
using UnityEngine;

public class WebGLTextureOptimizer
{
    [MenuItem("Tools/WebGL/Downscale All Textures")]
    static void DownscaleTextures()
    {
        string[] guids = AssetDatabase.FindAssets("t:Texture");

        foreach (string guid in guids)
        {
            string path = AssetDatabase.GUIDToAssetPath(guid);
            var importer = AssetImporter.GetAtPath(path) as TextureImporter;

            if (importer == null) continue;

            var settings = new TextureImporterPlatformSettings
            {
                name = "WebGL",
                overridden = true,
                maxTextureSize = 1024,
                format = TextureImporterFormat.ETC2_RGBA8
            };

            importer.SetPlatformTextureSettings(settings);
            importer.isReadable = false;
           // importer.mipmapEnabled = false;

            AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceUpdate);
        }

        Debug.Log("WebGL texture downscale completed");
    }
}