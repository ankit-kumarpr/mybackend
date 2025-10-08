const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const User = require("../models/User");
const generatePassword = require("../utils/generatePassword");
const {
  sendMail,
  welcomeForAdminTemplate,
  otpEmailTemplate,
  welcomeForUserTemplate,
  welcomeForIndividualTemplate,
} = require("../services/emailService");
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require("../services/tokenService");
const { createOtp, verifyOtp } = require("../services/otpService");
const Otp = require("../models/Otp");

const SALT_ROUNDS = 10;

/**
 * Create initial super admin (one-time) -- protected via a special key in request header or body
 */
const createSuperAdmin = async (req, res) => {
  try {
    const { key } = req.body;
    if (key !== process.env.SUPER_ADMIN_CREATION_KEY) {
      return res.status(403).json({ message: "Invalid key" });
    }
    const { name, email, phone } = req.body;
    if (!name || !email || !phone)
      return res.status(400).json({ message: "Missing fields" });

    const exists = await User.findOne({ $or: [{ email }, { phone }] });
    if (exists) return res.status(400).json({ message: "User exists" });

    const password = generatePassword(12);
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const user = new User({
      name,
      email,
      phone,
      password: hashed,
      role: "super_admin",
      emailVerified: true,
    });
    await user.save();

    await sendMail({
      to: email,
      subject: "Welcome to Gnet E-commerce (Super Admin)",
      html: welcomeForAdminTemplate({ name, email, phone, password,customId: user.customId, }),
    });

    res.status(201).json({ message: "Super admin created and email sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * super_admin registers admin or sales_person
 */
const registerBySuperAdmin = async (req, res) => {
  try {
    const creator = req.user;
    if (creator.role !== "super_admin")
      return res
        .status(403)
        .json({ message: "Only super admin can create admin/sales" });

    const { name, email, phone, role } = req.body;
    if (!["admin", "sales_person"].includes(role))
      return res.status(400).json({ message: "Invalid role" });

    const exists = await User.findOne({ $or: [{ email }, { phone }] });
    if (exists) return res.status(400).json({ message: "User exists" });

    const password = generatePassword(10);
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const user = new User({
      name,
      email,
      phone,
      password: hashed,
      role,
      emailVerified: true,
      createdBy: creator._id,
    });
    await user.save();

    await sendMail({
      to: email,
      subject: `Welcome to Gnet E-commerce (Role: ${role})`,
      html: welcomeForAdminTemplate({ name, email, phone, password,customId: user.customId, }),
    });

    res.status(201).json({ message: "User created and email sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Vendor/User self register -> send OTP to email for verification
 */
const selfRegister = async (req, res) => {
  try {
    const { name, email, phone, role } = req.body;
    if (!["vendor", "user", "individual"].includes(role))
      return res.status(400).json({ message: "role must be vendor, user, or individual" });

    const exists = await User.findOne({ $or: [{ email }, { phone }] });
    if (exists) return res.status(400).json({ message: "User exists" });

    // Temporarily store user data in OTP target or client should call verify endpoint with same details.
    // We'll create OTP bound to email. After verify, we'll create actual user.
    const otp = await createOtp({ target: email, type: "email_verify" });

    // send templated OTP email
    await sendMail({
      to: email,
      subject: "Gnet E-commerce — Verify your email",
      html: otpEmailTemplate({ code: otp.code }),
    });

    // We need to persist the name/phone/role until verification. Simplest: return a temporary token client must send when verifying.
    // But to keep flow stateless here, client will call /auth/verify-email and send name/email/phone/role and otp.
    res
      .status(200)
      .json({ message: "OTP sent to email. Verify to complete registration." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Verify email OTP and create the user with random password and send welcome email containing password
 */
const verifyEmailAndCreate = async (req, res) => {
  try {
    const { name, email, phone, role, code } = req.body;
    if (!name || !email || !phone || !role || !code)
      return res.status(400).json({ message: "Missing fields" });
    if (!["vendor", "user", "individual"].includes(role))
      return res.status(400).json({ message: "Invalid role" });

    const ok = await verifyOtp({ target: email, type: "email_verify", code });
    if (!ok) return res.status(400).json({ message: "Invalid or expired OTP" });

    const exists = await User.findOne({ $or: [{ email }, { phone }] });
    if (exists) return res.status(400).json({ message: "User exists" });

    const password = generatePassword(10);
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const user = new User({
      name,
      email,
      phone,
      password: hashed,
      role,
      emailVerified: true,
    });
    await user.save();

    // Send appropriate welcome email based on role
    let emailTemplate;
    let subject;
    
    if (role === 'individual') {
      emailTemplate = welcomeForIndividualTemplate({ name, email, phone, password, customId: user.customId });
      subject = "Welcome to Gnet E-commerce - Individual Account";
    } else {
      emailTemplate = welcomeForUserTemplate({ name, email, phone, password, customId: user.customId });
      subject = "Welcome to Gnet E-commerce";
    }

    await sendMail({
      to: email,
      subject: subject,
      html: emailTemplate,
    });

    res.status(201).json({ message: "User created and welcome email sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Login using email + password
 */
const loginWithEmail = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Missing fields" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    if (!user.active)
      return res.status(403).json({ message: "Account is disabled" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const accessToken = signAccessToken({ id: user._id, role: user.role });
    const refreshToken = signRefreshToken({ id: user._id, role: user.role });

    res.json({
      success: true,
      message: "Login successful",
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        customId: user.customId,
        email: user.email,
        phone: user.phone,
        role: user.role,
        kycStatus: user.kycStatus,
        kycRejectionReason: user.kycRejectionReason,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Send OTP to phone for login (phone -> OTP)
 */
const sendPhoneOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Missing phone" });
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: "Phone not registered" });

    // create OTP targeted at phone
    const otp = await createOtp({ target: phone, type: "phone_login" });

    // For demonstration we will send OTP to email if email exists, or respond ok.
    // In production you would integrate SMS gateway. For now, send OTP to user's email for reliability.
    if (user.email) {
      await sendMail({
        to: user.email,
        subject: "Your login OTP for Gnet E-commerce",
        html: otpEmailTemplate({ code: otp.code }),
      });
    }

    res.json({ message: "OTP sent (to registered email or SMS gateway)." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Verify phone OTP and log in
 */
const verifyPhoneOtpAndLogin = async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code)
      return res.status(400).json({ message: "Missing fields" });

    const ok = await verifyOtp({ target: phone, type: "phone_login", code });
    if (!ok) return res.status(400).json({ message: "Invalid or expired OTP" });

    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.active)
      return res.status(403).json({ message: "Account disabled" });

    const accessToken = signAccessToken({ id: user._id, role: user.role });
    const refreshToken = signRefreshToken({ id: user._id, role: user.role });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        kycStatus: user.kycStatus,
        kycRejectionReason: user.kycRejectionReason,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Refresh token endpoint
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(400).json({ message: "Missing refresh token" });

    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.id);
    if (!user)
      return res.status(401).json({ message: "Invalid refresh token" });
    if (!user.active)
      return res.status(403).json({ message: "Account disabled" });

    const newAccess = signAccessToken({ id: user._id, role: user.role });
    const newRefresh = signRefreshToken({ id: user._id, role: user.role });

    res.json({ accessToken: newAccess, refreshToken: newRefresh });
  } catch (err) {
    console.error(err);
    res.status(401).json({
      message: "Invalid or expired refresh token",
      error: err.message,
    });
  }
};

/**
 * Admin / Super Admin ability to activate/deactivate users
 */
const setActiveStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { active } = req.body;

    // only admins & super_admins can toggle, but requirement: super admin has right to activate/deactivate any account
    const actor = req.user;
    if (actor.role !== "super_admin" && actor.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Only super_admin can modify admins? We'll allow super_admin to change any. Admin can change lower-level roles.
    const target = await User.findById(userId);
    if (!target) return res.status(404).json({ message: "User not found" });

    // protect super_admin changes: only super_admin can toggle another super_admin
    if (target.role === "super_admin" && actor.role !== "super_admin") {
      return res.status(403).json({ message: "Cannot modify super admin" });
    }

    // admin cannot deactivate admin or higher
    if (
      actor.role === "admin" &&
      ["admin", "super_admin"].includes(target.role)
    ) {
      return res
        .status(403)
        .json({ message: "Admin cannot modify this account" });
    }

    target.active = !!active;
    await target.save();

    res.json({
      message: "Status updated",
      user: { id: target._id, active: target.active },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Get KYC status for a user
 */
const getKYCStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user is authenticated and can access this data
    const requester = req.user;
    if (requester._id.toString() !== userId && !["admin", "super_admin"].includes(requester.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const user = await User.findById(userId).select('kycStatus kycRejectionReason kycSubmittedAt kycApprovedAt kycDocuments');
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      kycStatus: user.kycStatus,
      kycRejectionReason: user.kycRejectionReason,
      kycSubmittedAt: user.kycSubmittedAt,
      kycApprovedAt: user.kycApprovedAt,
      kycDocuments: user.kycDocuments,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = {
  createSuperAdmin,
  registerBySuperAdmin,
  selfRegister,
  verifyEmailAndCreate,
  loginWithEmail,
  sendPhoneOtp,
  verifyPhoneOtpAndLogin,
  refreshToken,
  setActiveStatus,
  getKYCStatus,
};
