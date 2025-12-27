import { useContext, useEffect, useState } from "react";
import { Amplify } from "aws-amplify";
import {
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  confirmSignIn,
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
  userGroups: string[]; // Add this
  userRole: string | null; // Add this - primary group/role
  signIn: (email: string, password: string) => Promise<Result>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  confirmSignUp: (email: string, code: string) => Promise<Result>;
  signOut: () => Promise<Result>;
  changePassword: (newPassword: string) => Promise<Result>
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
  const [userGroups, setUserGroups] = useState<string[]>([]); // Add this
  const [userRole, setUserRole] = useState<string | null>(null); // Add this

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

  // Helper function to extract groups from token
  const getUserGroups = async (): Promise<string[]> => {
    try {
      const session = await fetchAuthSession();
      const groups = session.tokens?.accessToken?.payload["cognito:groups"];
      
      if (groups && Array.isArray(groups)) {
        return groups;
      }
      return [];
    } catch (error) {
      console.error("Error fetching user groups:", error);
      return [];
    }
  };

  // Helper function to determine primary role
  const getPrimaryRole = (groups: string[]): string | null => {
    if (groups.length === 0) return null;
    
    // Priority order: admin > newhire > visitor
    if (groups.includes("admin")) return "admin";
    if (groups.includes("newhire")) return "newhire";
    if (groups.includes("visitor")) return "visitor";
    
    // Return first group if none match
    return groups[0];
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

        // API REQUEST TO GET USERNAME, PROFILE IMAGE

        setEmail(user.signInDetails?.loginId || "");
        setUserId(user.userId);
        
        // Get user groups
        const groups = await getUserGroups();
        setUserGroups(groups);
        setUserRole(getPrimaryRole(groups));
        
        setIsAuthenticated(true);
      } else {
        clearIdToken();
      }
    } catch (error) {
      clearIdToken();
      setEmail("");
      setUserId("");
      setUserGroups([]);
      setUserRole(null);
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
        
        // Get user groups after sign in
        const groups = await getUserGroups();
        setUserGroups(groups);
        setUserRole(getPrimaryRole(groups));
        
        setIsAuthenticated(true);
        await saveIdToken();

        return { success: true, message: "Sign in successful" };
      }

      if (result.nextStep?.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
        return { 
          success: false, 
          message: "NEW_PASSWORD_REQUIRED"
        };
      }

      return { success: false, message: "Sign in incomplete" };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Sign in failed",
      };
    }
  };

  const signUp = async (
    email: string,
    password: string
  ): Promise<SignUpResult> => {
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
          userId: result.userId,
        };
      } else if (result.nextStep.signUpStep === "CONFIRM_SIGN_UP") {
        return {
          success: true,
          message: "Please check your email for verification code",
          userId: result.userId,
        };
      }

      return {
        success: false,
        message: "Sign up incomplete",
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
      setUserGroups([]);
      setUserRole(null);
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

  const changePassword = async (newPassword: string): Promise<Result> => {
    try {
      const result = await confirmSignIn({
        challengeResponse: newPassword
      });
      
      if (result.isSignedIn) {
        await checkAuthState();
        return { success: true, message: "Password changed successfully" };
      }
      
      return { success: false, message: "Password change failed" };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  return {
    isLoading,
    isAuthenticated,
    email,
    userId,
    userGroups,
    userRole,
    signIn,
    signUp,
    confirmSignUp,
    signOut,
    changePassword
  };
};