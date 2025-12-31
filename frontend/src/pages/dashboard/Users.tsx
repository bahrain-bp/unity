import DashboardLayout from "./DashboardLayout"
import Table from "@mui/joy/Table"
import Pagination from "@mui/material/Pagination"
import Stack from "@mui/material/Stack"
import { useState, useEffect } from "react"
import { ADDUSER } from "../../assets/icons"
import { GetUsers, CreateUser, UpdateUser, DeleteUser } from "../../services/Users"
import type { User } from "../../components/dashboard/types"
import UserRow from "../../components/dashboard/UserRow"
import AddUserModal from "../../components/dashboard/AddUserModal"
import DeleteUserModal from "../../components/dashboard/DeleteUserModal"
import EditUserModal from "../../components/dashboard/EditUserModal"

// Helper to transform Cognito user to our User interface
const transformCognitoUser = (cognitoUser: any): User => {
  const emailAttr = cognitoUser.Attributes?.find((attr: any) => attr.Name === "email")
  const raw = cognitoUser.UserStatus || "UNKNOWN";

  const statusLabel =
    raw === "CONFIRMED"
      ? "Confirmed"
      : raw === "FORCE_CHANGE_PASSWORD"
      ? "Temp password"
      : raw === "UNCONFIRMED"
      ? "Unconfirmed"
      : raw

  return {
    username: cognitoUser.Username || "",
    email: emailAttr?.Value || "",
    status: statusLabel,
  }
}

const Users = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [userToEdit, setUserToEdit] = useState<User | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isAdding, setIsAdding] = useState(false)


  const [currentPage, setCurrentPage] = useState(1)
  const [usersPerPage] = useState(9) 

  useEffect(() => {
    getUsers()
  }, [])

  const getUsers = async () => {
    try {
      setLoading(true)
      setError(null)

      const data = await GetUsers()
      const transformedUsers = (data.users || []).map(transformCognitoUser)
      setUsers(transformedUsers)
    } catch (err: any) {
      console.error("Error getting users:", err)
      const errorMessage = err.response?.data?.message || err.message || "Failed to get users"
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }


  const indexOfLastUser = currentPage * usersPerPage
  const indexOfFirstUser = indexOfLastUser - usersPerPage
  const currentUsers = users.slice(indexOfFirstUser, indexOfLastUser)
  const totalPages = Math.ceil(users.length / usersPerPage)


  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setCurrentPage(value)
  }

  const handleDeleteRequest = (user: User) => {
    setUserToDelete(user)
  }

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return

    setIsDeleting(true)
    setError(null)

    try {
      await DeleteUser(userToDelete.username)
      setUsers(users.filter(u => u.username !== userToDelete.username))
      setUserToDelete(null)

      const newTotalPages = Math.ceil((users.length - 1) / usersPerPage)
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages)
      }
    } catch (err: any) {
      console.error("Error deleting user:", err)
      setError(err.response?.data?.message || err.message || "Failed to delete user")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setUserToDelete(null)
    setIsDeleting(false)
  }

  const handleEditRequest = (user: User) => {
    setUserToEdit(user)
  }

  const handleEditSubmit = async (userData: { username: string; email: string; status: string }) => {
    if (!userToEdit) return

    setIsEditing(true)
    setError(null)

    try {
      await UpdateUser(userToEdit.username, { email: userData.email })

      setUsers(
        users.map(u =>
          u.username === userToEdit.username ? { ...u, email: userData.email } : u
        )
      )

      setUserToEdit(null)
    } catch (err: any) {
      console.error("Error updating user:", err)
      setError(err.response?.data?.message || err.message || "Failed to update user")
    } finally {
      setIsEditing(false)
    }
  }

  const handleEditCancel = () => {
    setUserToEdit(null)
    setIsEditing(false)
  }

  const handleAddUserClick = () => {
    setShowAddModal(true)
  }

  const handleAddUserSubmit = async (userData: { email: string; temporaryPassword?: string }) => {
    setIsAdding(true)
    setError(null)

    try {
      await CreateUser(userData)
      await getUsers()
      setShowAddModal(false)
    } catch (err: any) {
      console.error("Error creating user:", err)
      setError(err.response?.data?.message || err.message || "Failed to create user")
    } finally {
      setIsAdding(false)
    }
  }

  const handleAddUserCancel = () => {
    setShowAddModal(false)
    setIsAdding(false)
  }

  return (
    <DashboardLayout className="dashboard__users" header="Users">
      <button className="btn-orange btn-icon btn" onClick={handleAddUserClick}>
        {ADDUSER()} Add New User
      </button>

      {error && (
        <div className="dashboard__error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="dashboard__box">
        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center" }}>Loading users...</div>
        ) : (
          <>
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
                {currentUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "2rem" }}>
                      {users.length === 0 
                        ? 'No users found. Click "Add New User" to create one.'
                        : 'No users on this page.'}
                    </td>
                  </tr>
                ) : (
                  currentUsers.map(user => (
                    <UserRow 
                      key={user.username} 
                      user={user} 
                      onEdit={() => handleEditRequest(user)} 
                      onDelete={() => handleDeleteRequest(user)} 
                    />
                  ))
                )}
              </tbody>
            </Table>

            {users.length > usersPerPage && (
              <Stack spacing={2} alignItems="center" sx={{ padding: '2rem', borderTop: '1px solid #e0e0e0' }}>
                <Pagination 
                  count={totalPages} 
                  page={currentPage} 
                  onChange={handlePageChange}
                  color="primary"
                  shape="rounded"
                  showFirstButton
                  showLastButton
                />
              </Stack>
            )}
          </>
        )}
      </div>

      <AddUserModal
        isOpen={showAddModal}
        isAdding={isAdding}
        onClose={handleAddUserCancel}
        onSubmit={handleAddUserSubmit}
      />

      <DeleteUserModal
        isOpen={userToDelete !== null}
        username={userToDelete?.username ?? null}
        isDeleting={isDeleting}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
      />

      <EditUserModal
        isOpen={userToEdit !== null}
        user={userToEdit}
        isEditing={isEditing}
        onClose={handleEditCancel}
        onSubmit={handleEditSubmit}
      />
    </DashboardLayout>
  )
}

export default Users
