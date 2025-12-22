import { useState, useEffect } from "react"
import Modal from "@mui/material/Modal"
import Backdrop from "@mui/material/Backdrop"
import Fade from "@mui/material/Fade"
import Box from "@mui/material/Box"
import { MODAL_STYLE } from "./modalStyle"
interface AddUserModalProps {
  isOpen: boolean
  isAdding: boolean
  onClose: () => void
  onSubmit: (userData: { email: string; temporaryPassword?: string }) => void
}

const AddUserModal = ({ isOpen, isAdding, onClose, onSubmit }: AddUserModalProps) => {
  const [formVals, setFormVals] = useState({ email: "", temporaryPassword: "" })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormVals({ ...formVals, [e.target.id]: e.target.value })
  }

  const handleSubmit = () => {
    if (!formVals.email) return
    onSubmit({
      email: formVals.email,
      temporaryPassword: formVals.temporaryPassword || undefined,
    })
  }

  useEffect(() => {
    if (!isOpen) {
      setFormVals({ email: "", temporaryPassword: "" })
    }
  }, [isOpen])

  return (
    <Modal
      aria-labelledby="add-modal-title"
      aria-describedby="add-modal-description"
      open={isOpen}
      onClose={onClose}
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
          <h2 id="add-modal-title">Add New User</h2>
          <p id="add-modal-description">
            Create a new user account
          </p>
          <div className="dashboard__users--form">
            <input
              id="email"
              type="email"
              value={formVals.email}
              onChange={handleChange}
              placeholder="Email (required)"
              required
            />
            <input
              id="temporaryPassword"
              type="password"
              value={formVals.temporaryPassword}
              onChange={handleChange}
              placeholder="Temporary Password (optional)"
            />
          </div>
          <div className="dashboard__users--modal-actions">
            <button
              className="dashboard__users--btn btn btn-secondary"
              onClick={onClose}
              disabled={isAdding}
            >
              Cancel
            </button>
            <button
              className="dashboard__users--btn btn btn-primary"
              onClick={handleSubmit}
              disabled={!formVals.email || isAdding}
            >
              {isAdding ? "Adding..." : "Add User"}
            </button>
          </div>
        </Box>
      </Fade>
    </Modal>
  )
}

export default AddUserModal