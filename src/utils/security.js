import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Password hashing
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = (password, hash) => {
  return bcrypt.compare(password, hash);
};

// JWT tokens
export const generateAccessToken = (user) => {
  return jwt.sign(
    { 
      user_id: user.user_id, 
      role: user.role, 
      email: user.email 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRATION || '24h' }
  );
};

export const generateRefreshToken = (user) => {
  return jwt.sign(
    { user_id: user.user_id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d' }
  );
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};