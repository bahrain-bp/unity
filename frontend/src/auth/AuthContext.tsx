import { createContext } from "react";
import type { UseAuth } from "./AuthHook";

export const authContext = createContext({} as UseAuth);