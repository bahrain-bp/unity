import React from "react";
import { authContext } from "./AuthContext";
import { useProvideAuth } from "./AuthHook";

type Props = {
  children?: React.ReactNode;
};

export const ProvideAuth: React.FC<Props> = ({ children }) => {
  const auth = useProvideAuth();
  return <authContext.Provider value={auth}>{children}</authContext.Provider>;
};