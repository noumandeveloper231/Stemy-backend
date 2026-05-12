import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma.js";
import { sendEmail } from "../utils/email.js";
import { welcomeEmail, verificationOtpEmail, passwordResetOtpEmail } from "../utils/email-templates.js";
import { createAccessToken, randomToken } from "../utils/tokens.js";
import { env } from "../config/env.js";

const safeUserSelect = {
  id: true,
  email: true,
  displayName: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  emailVerified: true,
  plan: true,
  createdAt: true,
  updatedAt: true,
};

const authResponse = (user) => ({
  token: createAccessToken(user.id),
  user,
});

const googleClient = env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(env.GOOGLE_CLIENT_ID)
  : null;
const generateVerificationOtp = () =>
  String(Math.floor(100000 + Math.random() * 900000));

export const signup = async (req, res) => {
  try {
    const { email, password, displayName, firstName, lastName } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const verificationToken = generateVerificationOtp();
    const verificationExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        displayName: displayName || firstName || null,
        firstName: firstName || null,
        lastName: lastName || null,
        verificationToken,
        verificationExpiry,
      },
      select: safeUserSelect,
    });

    await sendEmail({
      to: email,
      subject: "Welcome to Stemy! 🎵",
      html: welcomeEmail(firstName),
    });

    await sendEmail({
      to: email,
      subject: "Verify your email",
      html: verificationOtpEmail(verificationToken),
    });

    return res.status(201).json(authResponse(user));
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ message: "Signup failed" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const userWithPassword = await prisma.user.findUnique({ where: { email } });
    if (!userWithPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const matches = await bcrypt.compare(password, userWithPassword.password);
    if (!matches) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userWithPassword.id },
      select: safeUserSelect,
    });
    return res.json(authResponse(user));
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Login failed" });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { otp, token, email } = req.body;
    const code = String(otp || token || "").trim();
    if (!code || !email) {
      return res.status(400).json({ message: "OTP and email are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (
      !user ||
      user.verificationToken !== code ||
      !user.verificationExpiry ||
      user.verificationExpiry < new Date()
    ) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification code" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationExpiry: null,
      },
    });

    return res.json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Verify email error:", error);
    return res.status(500).json({ message: "Failed to verify email" });
  }
};

export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({
        message: "If the email exists, a verification code was sent",
      });
    }

    const verificationToken = generateVerificationOtp();
    const verificationExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken, verificationExpiry },
    });

    await sendEmail({
      to: email,
      subject: "Your Stemy verification code",
      html: verificationOtpEmail(verificationToken, true),
    });

    return res.json({
      message: "If the email exists, a verification code was sent",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return res.status(500).json({ message: "Failed to resend verification" });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const resetToken = generateVerificationOtp();
      const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpiry },
      });

      await sendEmail({
        to: email,
        subject: "Your Stemy password reset code",
        html: passwordResetOtpEmail(resetToken),
      });
    }

    return res.json({
      message: "If the email exists, a reset code has been sent",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Failed to process request" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, otp, email, password } = req.body;
    const code = String(otp || token || "").trim();
    if (!code || !email || !password) {
      return res
        .status(400)
        .json({ message: "Reset code, email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (
      !user ||
      user.resetToken !== code ||
      !user.resetTokenExpiry ||
      user.resetTokenExpiry < new Date()
    ) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset code" });
    }

    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return res.json({ message: "Password has been reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Failed to reset password" });
  }
};

export const verifyResetOtp = async (req, res) => {
  try {
    const { otp, email } = req.body;
    const code = String(otp || "").trim();
    if (!code || !email) {
      return res.status(400).json({ message: "Reset code and email are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (
      !user ||
      user.resetToken !== code ||
      !user.resetTokenExpiry ||
      user.resetTokenExpiry < new Date()
    ) {
      return res.status(400).json({ message: "Invalid or expired reset code" });
    }

    return res.json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({ message: "Failed to verify OTP" });
  }
};

export const logout = async (req, res) => res.json({ message: "Logged out" });

export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: safeUserSelect,
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentSubscription = await prisma.subscription.findFirst({
      where: { userId: req.userId },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    return res.json({ user, subscription: currentSubscription });
  } catch (error) {
    console.error("Get me error:", error);
    return res.status(500).json({ message: "Failed to load profile" });
  }
};

export const googleCallback = async (req, res) => {
  try {
    const idToken = req.body?.idToken || req.body?.credential;
    const accessToken = req.body?.accessToken;
    if (!idToken && !accessToken) {
      return res.status(400).json({ message: "Google token is required" });
    }
    if (!googleClient || !env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ message: "Google auth is not configured" });
    }

    let profile = null;

    if (idToken) {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      profile = {
        email: payload?.email?.toLowerCase(),
        emailVerified: Boolean(payload?.email_verified),
        name: payload?.name || null,
        givenName: payload?.given_name || null,
        familyName: payload?.family_name || null,
        picture: payload?.picture || null,
      };
    } else {
      const userInfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!userInfoResponse.ok) {
        return res.status(401).json({ message: "Invalid Google token" });
      }

      const payload = await userInfoResponse.json();
      profile = {
        email: payload?.email?.toLowerCase(),
        emailVerified:
          payload?.email_verified === true ||
          payload?.email_verified === "true",
        name: payload?.name || null,
        givenName: payload?.given_name || null,
        familyName: payload?.family_name || null,
        picture: payload?.picture || null,
      };
    }

    const email = profile?.email;
    const emailVerified = profile?.emailVerified;

    if (!email || !emailVerified) {
      return res
        .status(401)
        .json({ message: "Google account email is not verified" });
    }

    let user = await prisma.user.findUnique({
      where: { email },
      select: safeUserSelect,
    });

    if (!user) {
      const generatedPassword = await bcrypt.hash(randomToken(), 10);
      user = await prisma.user.create({
        data: {
          email,
          password: generatedPassword,
          displayName: profile?.name || null,
          firstName: profile?.givenName || null,
          lastName: profile?.familyName || null,
          avatarUrl: profile?.picture || null,
          emailVerified: true,
        },
        select: safeUserSelect,
      });
    } else if (!user.emailVerified) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
        select: safeUserSelect,
      });
    }

    return res.json(authResponse(user));
  } catch (error) {
    console.error("Google login error:", error);
    return res.status(401).json({ message: "Invalid Google token" });
  }
};
