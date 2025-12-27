using UnityEngine;
using UnityEngine.InputSystem;

public class MapMenuToggle : MonoBehaviour
{
    [Header("UI")]
    public GameObject mapMenuRoot;

    [Header("Player Control")]
    public Behaviour playerLookScript;

    private InputAction toggleAction;
    private bool isOpen;

    void Awake()
    {
        // Create input action manually (New Input System safe)
        toggleAction = new InputAction(
            name: "ToggleMap",
            type: InputActionType.Button,
            binding: "<Keyboard>/m"
        );

        toggleAction.performed += _ => ToggleMenu();
    }

    void OnEnable()
    {
        toggleAction.Enable();
        CloseMenu();
    }

    void OnDisable()
    {
        toggleAction.Disable();
    }

    void ToggleMenu()
    {
  if (!isOpen) OpenMenu();

    }

    void OpenMenu()
    {
        //mapMenuRoot.transform.SetAsLastSibling();

        isOpen = true;

        if (mapMenuRoot)
            mapMenuRoot.SetActive(true);

        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;

        if (playerLookScript)
            playerLookScript.enabled = false;
    }

    void CloseMenu()
    {
        isOpen = false;

        if (mapMenuRoot)
            mapMenuRoot.SetActive(false);

        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;

        if (playerLookScript)
            playerLookScript.enabled = true;
    }
    public void CloseFromButton()
{
    CloseMenu();
}

}
