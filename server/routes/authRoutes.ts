import { Router } from 'express';
import {
  isPasswordSet,
  setupMasterPassword,
  loginMasterPassword,
  changeMasterPassword,
  verifySessionToken,
  revokeSessionToken,
  checkBruteForceLockout,
} from '../auth';

export const authRouter = Router();

authRouter.get('/auth/status', (req, res) => {
  const token = req.headers.authorization || (req.query.token as string);
  const passwordSet = isPasswordSet();
  const authenticated = !passwordSet || verifySessionToken(token);
  const lockout = checkBruteForceLockout();
  res.json({
    isPasswordSet: passwordSet,
    isAuthenticated: authenticated,
    locked: lockout.locked,
    remainingSec: lockout.remainingSec,
  });
});

authRouter.post('/auth/setup', (req, res) => {
  const { password } = req.body || {};
  const result = setupMasterPassword(password);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

authRouter.post('/auth/login', (req, res) => {
  const { password } = req.body || {};
  const result = loginMasterPassword(password);
  if (result.success) {
    res.json(result);
  } else {
    res.status(401).json(result);
  }
});

authRouter.post('/auth/change-password', (req, res) => {
  const token = req.headers.authorization || (req.query.token as string);
  if (!verifySessionToken(token)) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  const { currentPassword, newPassword } = req.body || {};
  const result = changeMasterPassword(currentPassword, newPassword);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

authRouter.post('/auth/logout', (req, res) => {
  const token = req.headers.authorization || (req.query.token as string);
  revokeSessionToken(token);
  res.json({ success: true });
});
