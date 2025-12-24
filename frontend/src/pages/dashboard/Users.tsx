import DashboardLayout from "./DashboardLayout";
import Table from "@mui/joy/Table";
import { useState } from "react";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";
import Fade from "@mui/material/Fade";
import Menu from "@mui/material/Menu";
import { ADDUSER, MORE, PEN, TRASH } from "../../assets/icons";

interface User {
  username: string;
  email: string;
  status: "Verified" | "Unverified";
}

const MODAL_STYLE = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "#fff",
  border: "none !important",
  boxShadow: 24,
  borderRadius: "1rem",
  fontFamily: "inherit",
  p: 3,
  fontSize: "1.8rem",
} as const;

const USERS_DATA: User[] = [
  { username: "Husain", email: "Husain@gmail.com", status: "Verified" },
  { username: "Hamed", email: "Hamed@gmail.com", status: "Verified" },
  { username: "Yahya", email: "Yahya@gmail.com", status: "Verified" },
  { username: "Malak", email: "Malak@gmail.com", status: "Unverified" },
  { username: "Zainab", email: "Zainab@gmail.com", status: "Verified" },
  { username: "Ruqaya", email: "Ruqaya@gmail.com", status: "Verified" },
  { username: "Khadija", email: "Khadija@gmail.com", status: "Unverified" },
  { username: "Ayah", email: "Ayah@gmail.com", status: "Unverified" },
  { username: "Manar", email: "Manar@gmail.com", status: "Verified" },
  { username: "Sara", email: "Sara@gmail.com", status: "Verified" },
];

interface UserRowProps {
  user: User;
  onEdit: () => void;
  onDelete: () => void;
}

function UserRow({ user, onEdit, onDelete }: UserRowProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const isMenuOpen = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    handleMenuClose();
    onEdit();
  };

  const handleDeleteClick = () => {
    handleMenuClose();
    onDelete();
  };

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
  );
}

// Delete modal component
interface DeleteModalProps {
  isOpen: boolean;
  username: string | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteModal({
  isOpen,
  username,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteModalProps) {
  return (
    <Modal
      aria-labelledby="delete-modal-title"
      aria-describedby="delete-modal-description"
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
          <p id="delete-modal-description">
            Are you sure you want to delete <b>{username}</b>?
          </p>
          <button className="dashboard__users--btn btn" onClick={onConfirm}>
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </Box>
      </Fade>
    </Modal>
  );
}

interface EditModalProps {
  isOpen: boolean;
  user: User | null;
  isEditing: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

function EditModal({
  isOpen,
  user,
  isEditing,
  onClose,
  onSubmit,
}: EditModalProps) {
  return (
    <Modal
      aria-labelledby="edit-modal-title"
      aria-describedby="edit-modal-description"
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
          <h2 id="edit-modal-title">Edit User</h2>
          <p id="edit-modal-description">
            Editing <b>{user?.username}</b>
          </p>
          <div className="dashboard__users--form">
            <input
              type="text"
              defaultValue={user?.username}
              placeholder="Username"
            />
            <input
              type="email"
              defaultValue={user?.email}
              placeholder="Email"
            />
            <select defaultValue={user?.status}>
              <option value="Verified">Verified</option>
              <option value="Unverified">Unverified</option>
            </select>
          </div>
          <div className="dashboard__users--modal-actions">
            <button
              className="dashboard__users--btn btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="dashboard__users--btn btn btn-primary"
              onClick={onSubmit}
            >
              {isEditing ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </Box>
      </Fade>
    </Modal>
  );
}

function Users() {
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const handleDeleteRequest = (user: User) => {
    setUserToDelete(user);
  };

  const handleDeleteConfirm = () => {
    setIsDeleting(true);

    // API REQUEST

    setIsDeleting(false);
    setUserToDelete(null);
  };

  const handleDeleteCancel = () => {
    setUserToDelete(null);
    setIsDeleting(false);
  };

  const handleEditRequest = (user: User) => {
    setUserToEdit(user);
  };

  const handleEditSubmit = () => {
    setIsEditing(true);

    // API REQUEST

    setIsEditing(false);
    setUserToEdit(null);
  };

  const handleEditCancel = () => {
    setUserToEdit(null);
    setIsEditing(false);
  };

  return (
    <DashboardLayout className="dashboard__users" header="Users">
      <button className="btn-orange btn-icon btn">
        {ADDUSER()} Add New User
      </button>

      <div className="dashboard__box">
        <Table size="lg" aria-label="users table" stickyHeader>
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th style={{ width: "15rem" }}>Status</th>
              <th style={{ width: "10rem" }}>Modify</th>
            </tr>
          </thead>
          <tbody>
            {USERS_DATA.map((user) => (
              <UserRow
                key={user.email}
                user={user}
                onEdit={() => handleEditRequest(user)}
                onDelete={() => handleDeleteRequest(user)}
              />
            ))}
          </tbody>
        </Table>
      </div>

      <DeleteModal
        isOpen={userToDelete !== null}
        username={userToDelete?.username ?? null}
        isDeleting={isDeleting}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
      />

      <EditModal
        isOpen={userToEdit !== null}
        user={userToEdit}
        isEditing={isEditing}
        onClose={handleEditCancel}
        onSubmit={handleEditSubmit}
      />
    </DashboardLayout>
  );
}

export default Users;
