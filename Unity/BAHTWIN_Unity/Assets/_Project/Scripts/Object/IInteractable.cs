using UnityEngine;

public interface IInteractable
{
    string PromptText { get; }
    bool CanInteract { get; }

    void OnFocusEnter(GameObject interactor);
    void OnFocusExit(GameObject interactor);
    void Interact(GameObject interactor);
}
