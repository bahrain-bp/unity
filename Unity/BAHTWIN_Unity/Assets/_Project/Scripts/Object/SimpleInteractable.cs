using UnityEngine;

public class SimpleInteractable : MonoBehaviour, IInteractable
{
    [SerializeField] private string prompt = "Press F to interact";
    [SerializeField] private bool canInteract = true;

    public string PromptText => prompt;
    public bool CanInteract => canInteract;

    public void OnFocusEnter(GameObject interactor)
    {
        // Later: enable outline yellow -> blue switch here
    }

    public void OnFocusExit(GameObject interactor)
    {
        // Later: disable outline or revert color here
    }

    public void Interact(GameObject interactor)
    {
        Debug.Log($"Interacted with: {name}");
    }
}
