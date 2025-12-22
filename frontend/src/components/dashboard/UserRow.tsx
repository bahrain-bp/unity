import { useState } from "react"
import type { User } from "../../components/dashboard/types"
import Menu from "@mui/material/Menu"
import { MORE, PEN, TRASH } from "../../assets/icons"
interface UserRowProps {
  user: User
  onEdit: () => void
  onDelete: () => void
}

const UserRow = ({ user, onEdit, onDelete }: UserRowProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const isMenuOpen = Boolean(anchorEl)

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleEdit = () => {
    handleMenuClose()
    onEdit()
  }

  const handleDeleteClick = () => {
    handleMenuClose()
    onDelete()
  }

  return (
    <tr>
      <td>{user.username}</td>
      <td>{user.email}</td>
      <td>
        <span
          className="dashboard__users--status"
          data-status={user.status.toLowerCase()}
        >
          {user.status}
        </span>
      </td>
      <td className="dashboard__users--btn">
        <div
          id="menu_btn"
          aria-controls={isMenuOpen ? "basic-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={isMenuOpen ? "true" : undefined}
          onClick={handleMenuOpen}
        >
          {MORE()}
        </div>
        <Menu
          id="basic-menu"
          anchorEl={anchorEl}
          open={isMenuOpen}
          onClose={handleMenuClose}
        >
          <div
            className="dashboard__users--menu-item"
            title="Edit"
            onClick={handleEdit}
          >
            {PEN()} Edit
          </div>
          <div
            className="dashboard__users--menu-item"
            title="Delete"
            onClick={handleDeleteClick}
          >
            {TRASH()} Delete
          </div>
        </Menu>
      </td>
    </tr>
  )
}

export default UserRow