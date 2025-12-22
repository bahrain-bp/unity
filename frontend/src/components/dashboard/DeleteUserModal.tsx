import Modal from "@mui/material/Modal"
import Fade from "@mui/material/Fade"
import Box from "@mui/material/Box"
import Backdrop from "@mui/material/Backdrop"
import { MODAL_STYLE } from "./modalStyle"

interface DeleteModalProps {
  isOpen: boolean
  username: string | null
  isDeleting: boolean
  onClose: () => void
  onConfirm: () => void
}

const DeleteModal = ({ isOpen, username, isDeleting, onClose, onConfirm }: DeleteModalProps) => {
  return (
    <Modal
      aria-labelledby="delete-modal-title"
      aria-describedby="delete-modal-description"
      open={isOpen}
      onClose={isDeleting ? undefined : onClose}
      closeAfterTransition
      slots={{ backdrop: Backdrop }}
      slotProps={{
        backdrop: {
          timeout: 500,
        },
      }}
    >
      <Fade in={isOpen}>
        <Box sx={MODAL_STYLE}>
          <h2 id="delete-modal-title">Confirm Deletion</h2>
          <p id="delete-modal-description">
            Are you sure you want to delete <b>{username}</b>?
            <br />
            <small style={{ color: "#666", marginTop: "0.5rem", display: "block" }}>
              This action cannot be undone.
            </small>
          </p>
          <div className="dashboard__users--modal-actions">
            <button
              className="dashboard__users--btn btn btn-secondary"
              onClick={onClose}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              className="dashboard__users--btn btn btn-primary"
              onClick={onConfirm}
              disabled={isDeleting}
              style={{ backgroundColor: "#dc3545" }}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </Box>
      </Fade>
    </Modal>
  )
}

export default DeleteModal