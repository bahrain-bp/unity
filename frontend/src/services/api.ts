import Axios from "axios"

export const BASE_URL = import.meta.env.VITE_API_URL 

const Client = Axios.create({baseURL: BASE_URL})

export default Client

