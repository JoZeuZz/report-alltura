jest.mock('isomorphic-dompurify', () => () => ({ sanitize: (value) => value }));

const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const authRoutes = require('./auth.routes');
const errorHandler = require('../middleware/errorHandler');
const AuthService = require('../services/auth.service');

jest.mock('../services/auth.service');
jest.mock('../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const buildApp = () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use(errorHandler);
  return app;
};

describe('POST /api/auth/login', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  it('should return accessToken and user, set HttpOnly cookie, no refreshToken in body', async () => {
    AuthService.loginUser.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 1, email: 'test@example.com', role: 'admin' },
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('accessToken', 'access-token');
    expect(res.body).not.toHaveProperty('refreshToken');
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=refresh-token/);
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    expect(res.headers['set-cookie'][0]).toMatch(/Path=\/api\/auth/i);
  });

  it('should return 401 with invalid credentials', async () => {
    const error = new Error('Invalid credentials.');
    error.statusCode = 401;
    AuthService.loginUser.mockRejectedValue(error);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@example.com', password: 'wrongpassword' });

    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  it('rota cookie con refresh token desde cookie', async () => {
    AuthService.refreshAccessToken.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'refreshToken=old-refresh')
      .send({});

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('accessToken', 'new-access');
    expect(res.body).not.toHaveProperty('refreshToken');
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=new-refresh/);
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
  });

  it('retorna 4xx sin cookie ni body', async () => {
    const error = new Error('Refresh token is required');
    error.statusCode = 400;
    AuthService.refreshAccessToken.mockRejectedValue(error);

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({});

    expect(res.statusCode).toBe(400);
  });
});
