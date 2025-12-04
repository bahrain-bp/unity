export const AwsConfigAuth = {
  Auth: {
    Cognito: {
      userPoolId: "us-east-1_pcnCiDaXa",
      userPoolClientId: import.meta.env.VITE_APP_AUTH_USER_POOL_WEB_CLIENT_ID,
      loginWith: {
        email: true,
      },
      signUpVerificationMethod: "code",
      userAttributes: {
        email: {
          required: true,
        },
      },
      allowGuestAccess: false,
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: true,
      },
    },
  },
};
