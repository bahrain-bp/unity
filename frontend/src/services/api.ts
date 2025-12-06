import Axios from "axios"

export const BASE_URL = import.meta.env.VITE_API_URL 

const Client = Axios.create({baseURL: BASE_URL})
export const PRE_REG_IMAGE_UPLOAD_URL = import.meta.env.VITE_PRE_REG_IMAGE_UPLOAD_API_URL;
export const PreRegImageUploadClient = Axios.create({
  baseURL: PRE_REG_IMAGE_UPLOAD_URL,
});

export default Client

