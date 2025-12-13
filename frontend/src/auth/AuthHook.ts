import { useContext, useEffect, useState } from "react";
import { Amplify } from "aws-amplify";
import {
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  getCurrentUser,
  fetchAuthSession,
} from "aws-amplify/auth";
import { AwsConfigAuth } from "../config/auth";
import { authContext } from "./AuthContext";

Amplify.configure(AwsConfigAuth);

export interface UseAuth {
  isLoading: boolean;
  isAuthenticated: boolean;
  email: string;
  userId: string;
  signIn: (email: string, password: string) => Promise<Result>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  confirmSignUp: (email: string, code: string) => Promise<Result>;
  signOut: () => Promise<Result>;
}

interface Result {
  success: boolean;
  message: string;
}

interface SignUpResult extends Result {
  userId?: string;
}

export const useAuth = () => {
  return useContext(authContext);
};

export const useProvideAuth = (): UseAuth => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    checkAuthState();
  }, []);

  const saveIdToken = async () => {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    if (idToken) {
      localStorage.setItem("idToken", idToken);
    }
  };

  const clearIdToken = () => {
    localStorage.removeItem("idToken");
    localStorage.removeItem("username");
  };

  const checkAuthState = async () => {
    try {
      const user = await getCurrentUser();
      const session = await fetchAuthSession();

      if (session.tokens) {
        const idToken = session.tokens.idToken?.toString();
        if (idToken) {
          localStorage.setItem("idToken", idToken);
        }

        setEmail(user.signInDetails?.loginId || "");
        setUserId(user.userId);
        setIsAuthenticated(true);
      } else {
        clearIdToken();
      }
    } catch (error) {
      clearIdToken();
      setEmail("");
      setUserId("");
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string): Promise<Result> => {
    try {
      const result = await amplifySignIn({
        username: email,
        password,
      });

      if (result.isSignedIn) {
        setEmail(email);
        const user = await getCurrentUser();
        setUserId(user.userId);
        setIsAuthenticated(true);

        await saveIdToken();

        return { success: true, message: "Sign in successful" };
      }

      return { success: false, message: "Sign in incomplete" };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Sign in failed",
      };
    }
  };

  const signUp = async (email: string, password: string): Promise<SignUpResult> => {
    try {
      const result = await amplifySignUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
          },
        },
      });

      if (result.isSignUpComplete) {
        return { 
          success: true, 
          message: "Sign up successful",
          userId: result.userId
        };
      } else if (result.nextStep.signUpStep === "CONFIRM_SIGN_UP") {
        return {
          success: true,
          message: "Please check your email for verification code",
          userId: result.userId
        };
      }

      return { 
        success: false, 
        message: "Sign up incomplete" 
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Sign up failed",
      };
    }
  };

  const confirmSignUp = async (
    email: string,
    code: string
  ): Promise<Result> => {
    try {
      await amplifyConfirmSignUp({
        username: email,
        confirmationCode: code,
      });
      return { success: true, message: "Email verified successfully" };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Verification failed",
      };
    }
  };

  const signOut = async (): Promise<Result> => {
    try {
      await amplifySignOut();
      setEmail("");
      setUserId("");
      setIsAuthenticated(false);
      clearIdToken();
      return { success: true, message: "Signed out successfully" };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Sign out failed",
      };
    }
  };

  return {
    isLoading,
    isAuthenticated,
    email,
    userId,
    signIn,
    signUp,
    confirmSignUp,
    signOut,
  };
};