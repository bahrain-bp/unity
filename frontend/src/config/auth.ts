// frontend/src/config/auth.ts

// config/auth.ts - No explicit type
export const AwsConfigAuth = {
  Auth: {
    Cognito: {
      region: import.meta.env.VITE_APP_AUTH_REGION,
      userPoolId: import.meta.env.VITE_APP_AUTH_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_APP_AUTH_USER_POOL_WEB_CLIENT_ID,
      loginWith: { email: true },
      signUpVerificationMethod: "code",
    },
  },
};
// keep your custom rules separately
export const AuthRules = {
  userAttributes: {
    email: { required: true },
  },
  allowGuestAccess: false,
  passwordFormat: {
    minLength: 8,
    requireLowercase: true,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialCharacters: true,
  },
};
