using UnityEngine;


public class TakeScreenshot2 : MonoBehaviour
{
    private int screenshotCount = 0;

	void Start()
	{
		DontDestroyOnLoad (transform.gameObject);
	}

    // Check for screenshot key each frame
    void Update()
    {
        // take screenshot on F10 key

        if (Input.GetKeyDown("f10"))
        {
            //GX2DebugCaptureFrame();
            string screenshotFilename;
            do
            {
                screenshotCount++;
                screenshotFilename = "screenshot" + screenshotCount + ".png";
 
            } while (System.IO.File.Exists(screenshotFilename));

            Debug.Log("snapping " + screenshotFilename);
            ScreenCapture.CaptureScreenshot(screenshotFilename);
        }
    }
}