import Axios, { type AxiosInstance } from "axios"

export const BASE_URL = import.meta.env.VITE_API_URL
export const IMAGE_URL = import.meta.env.VITE_IMAGE_API_URL;
export const FEEDBACK_URL = import.meta.env.VITE_FEEDBACK_API_URL;

export const Client: AxiosInstance = Axios.create({ baseURL: BASE_URL })
export const ImageClient = Axios.create({ baseURL: IMAGE_URL });
export const FeedbackClient = Axios.create({ baseURL: FEEDBACK_URL });


Client.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem('idToken')

    if (token) {
      config.headers['authorization'] = `Bearer ${token}`
    }

    return config
  },
  async (error) => {
    console.log({ msg: 'Axios Interceptor Error', error })
    throw error
  }
)

Client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('idToken')
      localStorage.removeItem('username')
      console.error('Session expired. Please login again.')
      
      window.location.href = '/auth'
    }
    throw error
  }
)

export default Client
