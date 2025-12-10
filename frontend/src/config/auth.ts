export const AwsConfigAuth = {
  Auth: {
    Cognito: {
      userPoolId: "us-east-1_3TSi7JPvf",
      userPoolClientId: "7nq4lkthr815h7ucksnl0cirm6",
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
