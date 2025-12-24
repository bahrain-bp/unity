import type { User } from "./types"
import { useState, useEffect } from "react"
import Modal from "@mui/material/Modal"
import Fade from "@mui/material/Fade"
import Box from "@mui/material/Box"
import Backdrop from "@mui/material/Backdrop"
import { MODAL_STYLE } from "./modalStyle"

interface EditModalProps {
  isOpen: boolean
  user: User | null
  isEditing: boolean
  onClose: () => void
  onSubmit: (userData: { username: string; email: string; status: string }) => void
}

const EditModal = ({ isOpen, user, isEditing, onClose, onSubmit }: EditModalProps) => {
  const [formVals, setFormVals] = useState({
    username: user?.username || "",
    email: user?.email || "",
    status: user?.status || "Verified",
  })

  useEffect(() => {
    if (user) {
      setFormVals({
        username: user.username || "",
        email: user.email || "",
        status: user.status || "Verified",
      })
    }
  }, [user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormVals({ ...formVals, [e.target.id]: e.target.value })
  }

  const handleSubmit = () => {
    onSubmit(formVals)
  }

  return (
    <Modal
      aria-labelledby="edit-modal-title"
      aria-describedby="edit-modal-description"
      open={isOpen}
      onClose={isEditing ? undefined : onClose}
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
          <h2 id="edit-modal-title">Edit User</h2>
          <p id="edit-modal-description">
            Editing <b>{user?.username}</b>
          </p>
          <div className="dashboard__users--form">
            <div style={{ marginBottom: "1rem" }}>
              <label htmlFor="username" style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9em", color: "#666" }}>
                Username (cannot be changed)
              </label>
              <input
                id="username"
                type="text"
                value={formVals.username}
                onChange={handleChange}
                placeholder="Username"
                disabled
                style={{ backgroundColor: "#f5f5f5" }}
              />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label htmlFor="email" style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9em", color: "#666" }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                value={formVals.email}
                onChange={handleChange}
                placeholder="Email"
              />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label htmlFor="status" style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9em", color: "#666" }}>
                Status (managed by Cognito)
              </label>
              <select
                id="status"
                value={formVals.status}
                onChange={handleChange}
                disabled
                style={{ backgroundColor: "#f5f5f5" }}
              >
                <option value="Verified">Verified</option>
                <option value="Unverified">Unverified</option>
              </select>
            </div>
          </div>
          <div className="dashboard__users--modal-actions">
            <button
              className="dashboard__users--btn btn btn-secondary"
              onClick={onClose}
              disabled={isEditing}
            >
              Cancel
            </button>
            <button
              className="dashboard__users--btn btn btn-primary"
              onClick={handleSubmit}
              disabled={isEditing || !formVals.email}
            >
              {isEditing ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </Box>
      </Fade>
    </Modal>
  )
}

export default EditModal