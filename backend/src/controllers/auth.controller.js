const AuthService = require('../services/auth.service');
const { TOKEN_CONFIG } = require('../middleware/auth');
const { logger } = require('../lib/logger');

const setRefreshCookie = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY_SECONDS * 1000,
  });
};

/**
 * AuthController
 * Capa de Controlador - Orquestación HTTP
 * Responsabilidades:
 * - Extraer datos del request (body, headers, params)
 * - Llamar a la capa de servicio
 * - Formatear y enviar respuestas HTTP
 * - Gestionar errores HTTP
 * 
 * PROHIBIDO: No debe contener lógica de negocio ni consultas SQL
 */
class AuthController {
  /**
   * POST /api/auth/register
   * Registrar un nuevo usuario
   */
  static async register(req, res, next) {
    try {
      const { email, password, first_name, last_name, role, rut, phone_number } = req.body;

      const result = await AuthService.registerUser({
        email,
        password,
        first_name,
        last_name,
        role,
        rut,
        phone_number,
      });

      return res.status(201).json(result);
    } catch (error) {
      logger.error('Error en registro de usuario:', error);
      next(error);
    }
  }

  /**
   * POST /api/auth/login
   * Iniciar sesión
   */
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('user-agent') || 'Unknown';

      const { accessToken, refreshToken, user } = await AuthService.loginUser(email, password, ip, userAgent);

      setRefreshCookie(res, refreshToken);

      return res.status(200).json({ accessToken, user });
    } catch (error) {
      logger.error('Error en login:', error);
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Cerrar sesión
   */
  static async logout(req, res, next) {
    try {
      const userId = req.user.id;
      const accessToken = req.headers.authorization?.split(' ')[1];

      await AuthService.logoutUser(userId, accessToken);

      res.clearCookie('refreshToken', { path: '/api/auth' });

      return res.status(200).json({
        message: 'Logged out successfully',
      });
    } catch (error) {
      logger.error('Error en logout:', error);
      next(error);
    }
  }

  /**
   * POST /api/auth/refresh
   * Refrescar access token
   */
  static async refresh(req, res, next) {
    try {
      // TODO: retirar fallback a body tras un ciclo de deploy (sesiones pre-cookie)
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

      const { accessToken, refreshToken: newRefreshToken } = await AuthService.refreshAccessToken(refreshToken);

      setRefreshCookie(res, newRefreshToken);

      return res.status(200).json({ accessToken });
    } catch (error) {
      logger.error('Error en refresh token:', error);
      next(error);
    }
  }

  /**
   * POST /api/auth/change-password
   * Cambiar contraseña
   */
  static async changePassword(req, res, next) {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      const result = await AuthService.changePassword(userId, currentPassword, newPassword);

      return res.status(200).json(result);
    } catch (error) {
      logger.error('Error en cambio de contraseña:', error);
      next(error);
    }
  }
}

module.exports = AuthController;
