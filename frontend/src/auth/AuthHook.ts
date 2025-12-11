import { useContext, useEffect, useState } from "react";
import { Amplify } from "aws-amplify";
import { 
  signIn as amplifySignIn, 
  signOut as amplifySignOut, 
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  getCurrentUser,
  fetchAuthSession
} from "aws-amplify/auth";

import { authContext } from "./AuthContext";

import { AwsConfigAuth } from "../config/auth";

import type { ResourcesConfig } from "aws-amplify";
Amplify.configure(AwsConfigAuth as ResourcesConfig);

export interface UseAuth {
  isLoading: boolean;
  isAuthenticated: boolean;
  email: string;
  userId?: string;
  signIn: (email: string, password: string) => Promise<Result>;
  signUp: (email: string, password: string, fileKey?: string) => Promise<ResultWithUserId>;
  confirmSignUp: (email: string, code: string) => Promise<Result>;
  signOut: () => Promise<Result>;
}

interface Result {
  success: boolean;
  message: string;
}

interface ResultWithUserId extends Result {
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

  const checkAuthState = async () => {
    try {
      const user = await getCurrentUser();
      const session = await fetchAuthSession();
      
      if (session.tokens) {
        setEmail(user.signInDetails?.loginId || "");
        setUserId(user.userId || "");
        setIsAuthenticated(true);
      }
    } catch (error) {
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
        username: email.toLowerCase().trim(),
        password 
      });
      
      if (result.isSignedIn) {
        setEmail(email);
        try {
          const user = await getCurrentUser();
          setUserId(user.userId || "");
        } catch {}
        setIsAuthenticated(true);
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

  const signUp = async (email: string, password: string, fileKey?: string): Promise<ResultWithUserId> => {
    try {
      const result = await amplifySignUp({
        username: email,
        password,
        options: {
          userAttributes: { email },
          clientMetadata: fileKey ? { profilePictureKey: fileKey } : undefined,
        },
      });

      if (result.isSignUpComplete) {
        return { success: true, message: "Sign up successful", userId: result.userId };
      } else if (result.nextStep.signUpStep === "CONFIRM_SIGN_UP") {
        return { 
          userId: result.userId,
          success: true, 
          message: "Please check your email for verification code",
        };
      }
      
      return { success: false, message: "Sign up incomplete", userId: result.userId };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Sign up failed",
      };
    }
  };

  const confirmSignUp = async (email: string, code: string): Promise<Result> => {
    try {
      await amplifyConfirmSignUp({ 
        username: email, 
        confirmationCode: code 
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