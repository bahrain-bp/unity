import Axios from "axios";

export const BASE_URL = import.meta.env.VITE_API_URL;
export const IMAGE_URL = import.meta.env.VITE_IMAGE_API_URL;
export const FEEDBACK_URL = import.meta.env.VITE_FEEDBACK_API_URL;

export const Client = Axios.create({ baseURL: BASE_URL });
export const ImageClient = Axios.create({ baseURL: IMAGE_URL });
export const FeedbackClient = Axios.create({ baseURL: FEEDBACK_URL });
