  import bcrypt from 'bcryptjs';
  import jwt from 'jsonwebtoken';
  import AppError from '../../utils/services/AppError.js';
  import { sendVerificationEmail } from '../../utils/Email/sendVerificationEmail.js';
  import { userModel } from '../../../database/models/user.model.js';

  // Helper: generate 6-char alphanumeric code
  function generateVerificationCode() {
      const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += ALPHA.charAt(Math.floor(Math.random() * ALPHA.length));
      }
      return code;
    }
    
    export const registerUser = async (req, res, next) => {
      const { name, email, password, phone } = req.body;
      if (!name || !email || !password || !phone) {
        return next(new AppError('All fields are required', 400));
      }
      const exists = await userModel.findOne({ email });
      if (exists) {
        return next(new AppError('Email already in use', 409));
      }
      const hashed = await bcrypt.hash(password, 10);
      const code = generateVerificationCode();
    
      const user = await userModel.create({
        name,
        email,
        password: hashed,
        phone,
        verificationCode: code
      });
    
      await sendVerificationEmail(user);
      res.status(201).json({ success: true, message: 'Registration successful. Please check your email to verify.' });
    };
    
    // Verify user email
    export const verifyEmail = async (req, res, next) => {
      const { email, code } = req.body;
      if (!email || !code) {
        return next(new AppError('Email and verification code are required', 400));
      }
      const user = await userModel.findOne({ email });
      if (!user) {
        return next(new AppError('User not found', 404));
      }
      if (user.isVerified) {
        return next(new AppError('Email already verified', 400));
      }
      if (user.verificationCode !== code) {
        return next(new AppError('Invalid verification code', 400));
      }
      user.isVerified = true;
      user.verificationCode = undefined;
      await user.save();
      res.status(200).json({ success: true, message: 'Email verified successfully' });
    };
    
    // Resend verification code
    export const resendVerificationCode = async (req, res, next) => {
      const { email } = req.body;
      if (!email) {
        return next(new AppError('Email is required', 400));
      }
      const user = await userModel.findOne({ email });
      if (!user) {
        return next(new AppError('User not found', 404));
      }
      if (user.isVerified) {
        return next(new AppError('Email already verified', 400));
      }
      const newCode = generateVerificationCode();
      user.verificationCode = newCode;
      await user.save();
      await sendVerificationEmail(user);
      res.status(200).json({ success: true, message: 'Verification code resent' });
    };
    
    // Login user
    export const loginUser = async (req, res, next) => {
      const { email, password } = req.body;
      if (!email || !password) {
        return next(new AppError('Email and password are required', 400));
      }
      const user = await userModel.findOne({ email });
      if (!user) {
        return next(new AppError('Invalid email or password', 401));
      }
      if (!user.isVerified) {
        return next(new AppError('Please verify your email first', 403));
      }
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return next(new AppError('Invalid email or password', 401));
      }
      const token = jwt.sign(
        { id: user._id, name: user.name, email: user.email, phone: user.phone },
        process.env.JWT_SECRET,
        { expiresIn: '2h' }
      );
      res.status(200).json({ success: true, token });
    };
    
    export const getUserProfile = async (req, res, next) => {
      const userId = req.user?._id;
      const user = await userModel.findById(userId).select('-password -verificationCode');
      if (!user) {
        return next(new AppError('User not found', 404));
      }
      res.status(200).json({ success: true, data: user });
    };
    
    export const updateUserProfile = async (req, res, next) => {
      const userId = req.user?._id;
      const user = await userModel.findByIdAndUpdate(userId,{name:req.body.name,phone:req.body.phone},{new:true});
      res.status(200).json({ success: true, data: user });
    };
    