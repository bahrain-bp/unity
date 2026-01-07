import type { User } from "./types"
import { useState, useEffect } from "react"
import Modal from "@mui/material/Modal"
import Fade from "@mui/material/Fade"
import Box from "@mui/material/Box"
import Backdrop from "@mui/material/Backdrop"
import { MODAL_STYLE } from "./modalStyle"

const STATUS_OPTIONS = ["Confirmed", "Temp password", "Unconfirmed", "UNKNOWN"] as const

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
    status: user?.status || "UNKNOWN",
  })

  useEffect(() => {
    if (user) {
      setFormVals({
        username: user.username || "",
        email: user.email || "",
        status: user.status || "UNKNOWN",
      })
    }
  }, [user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormVals({ ...formVals, [e.target.id]: e.target.value })
  }

  return (
    <Modal
      open={isOpen}
      onClose={isEditing ? undefined : onClose}
      closeAfterTransition
      slots={{ backdrop: Backdrop }}
      slotProps={{ backdrop: { timeout: 500 } }}
    >
      <Fade in={isOpen}>
        <Box sx={MODAL_STYLE}>
          <h2>Edit User</h2>
          <p>Editing <b>{user?.username}</b></p>

          <div className="dashboard__users--form">
            {/* Username */}
            <div className="form-group">
              <label>Username (cannot be changed)</label>
              <input
                id="username"
                value={formVals.username}
                disabled
                className="input-disabled"
              />
            </div>

            {/* Email */}
            <div className="form-group">
              <label>Email</label>
              <input
                id="email"
                type="email"
                value={formVals.email}
                onChange={handleChange}
              />
            </div>

            {/* Status */}
            <div className="form-group">
              <label>Status (managed by Cognito)</label>
              <select id="status" value={formVals.status} disabled className="input-disabled">
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
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
              onClick={() => onSubmit(formVals)}
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
