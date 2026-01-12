# Echo Show Setup Guide

This guide explains how to set up the Echo Show device and configure the Alexa skill for the AWS BAHTWIN admin system.

---

## Part 1 - Echo Show Device Setup

### Step 1 - Power the Echo Show

1. Plug the Echo Show into power.
2. Wait for it to start.
3. Choose your language.
4. Connect to Wi-Fi.

### Step 2 - Install Alexa App on Phone

1. Open App Store or Play Store.
2. Search for **Amazon Alexa**.
3. Install the app.
4. Log in with your Amazon account.

### Step 3 - Connect Echo Show to Alexa App

1. Open the Alexa App.
2. Go to **Devices**.
3. Tap **+ Add Device**.
4. Choose **Amazon Echo**.
5. Choose **Echo Show**.
6. Follow the on-screen instructions.

---

## Part 2 - Alexa Developer Console Setup

### Step 1 - Open Alexa Developer Console

Go to:
**https://developer.amazon.com/alexa/console/ask**
Log in using your Amazon account.

### Step 2 - Create the Skill

1. Click **Create Skill**.
2. **Skill name:** AWS BahTwin
3. **Language:** English
4. **Skill type:** Custom
5. **Backend:** Provision your own backend
6. Click **Create Skill**.

### Step 3 - Set Invocation Name

Go to:
**Build -> Invocation**

Set invocation name to:
**activate admin mode**

**What this does**
The invocation name is the phrase used to open the skill.
Example:
*"Alexa, open activate admin mode"*

Click **Save Model**.

### Step 4 - Create Intents

Go to:
**Build -> Interaction Model -> Intents**

**What is an Intent?**
An intent represents what the user wants Alexa to do.
Each intent connects a voice command to a backend action.

**Required Intents**

| Intent Name             |
|-------------------------|
| GetActiveUsersNowIntent |
| GetUsersTodayIntent     |
| GetTemperatureIntent    |
| ShowDashboardIntent     |
| GetDailySummaryIntent   |

**Sample Utterances**

- **GetActiveUsersNowIntent**
  - show active users
  - active users now
  - how many users are online

- **GetUsersTodayIntent**
  - show today users
  - users today
  - how many users visited today

- **GetTemperatureIntent**
  - show temperature
  - temperature now
  - sensor temperature

- **ShowDashboardIntent**
  - show dashboard
  - open dashboard
  - admin dashboard

- **GetDailySummaryIntent**
  - show daily summary
  - today summary
  - daily report

Click **Save Model**.

### Step 5 - Build the Model

Click **Build Model** (top right).
Wait until it finishes.

### Step 6 - Connect Lambda Backend

> The Echo Show Alexa Lambda is defined in `AlexaStack.ts` as the `AlexaAdminLambda` function, and its ARN is exported there as a CloudFormation output named `AlexaLambdaArn`. Use that output value for your Alexa skill configuration after deployment.
>
> If you want the exact ARN value, check the CloudFormation stack output or `cdk deploy` output for `Unity-AlexaStack` (from `my-cdk-app.ts`).

1. Go to: **Build -> Endpoint**
2. Choose **AWS Lambda ARN**.
3. Paste your Lambda ARN.
4. Make sure the region matches your Lambda region.
5. Click **Save Endpoints**.

> The Lambda ARN can be found in the AWS Lambda Console.

### Step 7 - Enable Test Mode

Go to **Test** from the top menu.
Turn **Test ON**.

### Step 8 - Test Voice Commands

In the test console, say or type:
**open bahtwin admin**

If Alexa responds, the setup is successful.

### Step 9 - Use on Echo Show Device

Make sure:

- Echo Show uses the same Amazon account.
- Alexa App uses the same Amazon account.

Then say:
**"Alexa, open BAHTWIN Admin"**
