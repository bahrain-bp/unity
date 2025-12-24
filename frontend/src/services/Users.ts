import Client from "./api"

interface CreateUser {
  email: string
  temporaryPassword?: string
}

interface UpdateUser {
  email: string
}

interface CognitoUser {
  Username: string
  Attributes: Array<{ Name: string; Value: string }>
  UserStatus: string
  Enabled: boolean
  UserCreateDate: string
  UserLastModifiedDate: string
}

interface GetUsersRes {
  users: CognitoUser[]
}

interface CreateUserRes {
  message: string
  user: {
    username?: string
    email: string
    status?: string
  }
}

interface UpdateUserRes {
  message: string
  userId: string
  email: string
}

interface DeleteUserRes {
  message: string
  userId: string
}

export const GetUsers = async (): Promise<GetUsersRes> => {
  try {
    const res = await Client.get<GetUsersRes>("/users")
    return res.data
  } catch (error) {
    throw error
  }
}

export const CreateUser = async (data: CreateUser): Promise<CreateUserRes> => {
  try {
    const res = await Client.post<CreateUserRes>("/users", data)
    return res.data
  } catch (error) {
    throw error
  }
}

export const UpdateUser = async (
  userId: string,
  data: UpdateUser
): Promise<UpdateUserRes> => {
  try {
    // encodeURIComponent is used because userId is an email with special characters like @
    const res = await Client.put<UpdateUserRes>(
      `/users/${encodeURIComponent(userId)}`,
      data
    )
    return res.data
  } catch (error) {
    throw error
  }
}

export const DeleteUser = async (userId: string): Promise<DeleteUserRes> => {
  try {
    const res = await Client.delete<DeleteUserRes>(
      `/users/${encodeURIComponent(userId)}`
    )
    return res.data
  } catch (error) {
    throw error
  }
}
