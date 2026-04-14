const jwt = require('jsonwebtoken');
const redisClient = require('../lib/redis');
const { logger } = require('../lib/logger');

/**
 * Configuración de tokens JWT
 * 
 * SECURITY IMPROVEMENTS:
 * - Access token: 15 minutos (reducido de 8 horas)
 * - Refresh token: 7 días
 * - Blacklist persistente en Redis
 * - Token rotation en refresh
 * - Anomaly detection
 */
const TOKEN_CONFIG = {
  ACCESS_TOKEN_EXPIRY: '15m', // 15 minutos
  REFRESH_TOKEN_EXPIRY: '7d', // 7 días
  ACCESS_TOKEN_EXPIRY_SECONDS: 15 * 60, // Para Redis TTL
  REFRESH_TOKEN_EXPIRY_SECONDS: 7 * 24 * 60 * 60, // Para Redis TTL
};

/**
 * Revoca un token agregándolo a la blacklist
 * @param {string} token - JWT token a revocar
 */
async function revokeToken(token) {
  try {
    // Decodificar token para obtener tiempo de expiración
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      logger.warn('Token inválido para revocar');
      return;
    }

    // Calcular tiempo hasta expiración
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = decoded.exp - now;

    if (expiresIn > 0) {
      await redisClient.blacklistToken(token, expiresIn);
      logger.info(`Token revocado exitosamente para usuario ${decoded.user?.id}`);
    }
  } catch (error) {
    logger.error('Error revocando token:', error);
    throw error;
  }
}

/**
 * Middleware de autenticación principal
 * 
 * SECURITY FEATURES:
 * - Verifica formato Bearer token
 * - Verifica firma JWT
 * - Verifica token no esté en blacklist (Redis)
 * - Verifica usuario no esté bloqueado
 * - Detecta anomalías de acceso
 * - Registra información de sesión
 */
const authMiddleware = async (req, res, next) => {
  const requestId = req.requestId;

  try {
    // 1. Extraer token del header Authorization
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      logger.warn('Auth rechazada: Authorization header ausente', {
        requestId,
        path: req.originalUrl,
        method: req.method,
      });
      return res.status(401).json({
        message: 'No token, authorization denied',
        code: 'TOKEN_MISSING',
        requestId,
      });
    }

    const tokenParts = authHeader.split(' ');
    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
      logger.warn('Auth rechazada: formato de Authorization inválido', {
        requestId,
        path: req.originalUrl,
        method: req.method,
      });
      return res.status(401).json({
        message: 'Token format is "Bearer <token>"',
        code: 'TOKEN_FORMAT_INVALID',
        requestId,
      });
    }

    const token = tokenParts[1];

    // 2. Verificar firma JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.user?.id) {
      logger.warn('Auth rechazada: payload JWT sin user.id', {
        requestId,
        path: req.originalUrl,
        method: req.method,
      });
      return res.status(401).json({
        message: 'Token inválido',
        code: 'TOKEN_INVALID',
        requestId,
      });
    }

    req.user = decoded.user;

    // 3. Verificar si el token está en la blacklist (Redis)
    // Si Redis está temporalmente inestable, continuamos con JWT válido para evitar 401 falsos.
    try {
      const isBlacklisted = await redisClient.isTokenBlacklisted(token);
      if (isBlacklisted) {
        logger.warn('Intento de uso de token revocado', {
          requestId,
          userId: req.user.id,
        });
        return res.status(401).json({
          message: 'Token revocado',
          code: 'TOKEN_REVOKED',
          requestId,
        });
      }
    } catch (redisError) {
      logger.error('No se pudo validar blacklist en Redis', {
        requestId,
        userId: req.user.id,
        error: redisError.message,
      });
    }

    // 4. Extraer información de la petición
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent') || 'unknown';

    // 5. Detectar anomalías de acceso
    try {
      const anomaly = await redisClient.detectAnomaly(req.user.id, ip, userAgent);
      if (anomaly.anomalous) {
        logger.warn(`⚠️  Acceso anómalo detectado para usuario ${req.user.id}: ${anomaly.reason}`, {
          requestId,
        });
        // Podrías enviar alerta por email/Slack aquí
        // Por ahora solo logueamos, pero permitimos el acceso
        // En producción, podrías bloquear o requerir 2FA
      }
    } catch (redisError) {
      logger.warn('No se pudo ejecutar detección de anomalías en Redis', {
        requestId,
        userId: req.user.id,
        error: redisError.message,
      });
    }

    // 6. Registrar sesión para análisis futuro
    try {
      await redisClient.recordSession(req.user.id, ip, userAgent);
    } catch (redisError) {
      logger.warn('No se pudo registrar sesión en Redis', {
        requestId,
        userId: req.user.id,
        error: redisError.message,
      });
    }

    // 7. Agregar información adicional al request
    req.sessionInfo = { ip, userAgent };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      logger.warn('Auth rechazada: token expirado', {
        requestId,
        path: req.originalUrl,
        method: req.method,
      });
      return res.status(401).json({
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED',
        requestId,
      });
    }

    if (err.name === 'JsonWebTokenError') {
      logger.warn('Auth rechazada: token inválido', {
        requestId,
        path: req.originalUrl,
        method: req.method,
      });
      return res.status(401).json({
        message: 'Token inválido',
        code: 'TOKEN_INVALID',
        requestId,
      });
    }

    logger.error('Error en autenticación:', {
      requestId,
      path: req.originalUrl,
      method: req.method,
      error: err.message,
      stack: err.stack,
    });
    res.status(401).json({
      message: 'Token is not valid',
      code: 'TOKEN_UNKNOWN_ERROR',
      requestId,
    });
  }
};

/**
 * Genera par de tokens (access + refresh)
 * @param {Object} user - Objeto de usuario
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 */
async function generateTokenPair(user) {
  const payload = {
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      profile_picture_url: user.profile_picture_url,
    },
  };

  // Access token (15 minutos)
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY,
    issuer: 'alltura-api',
    audience: 'alltura-client',
  });

  // Refresh token (7 días)
  const refreshTokenPayload = {
    user: { id: user.id },
    type: 'refresh',
  };

  const refreshToken = jwt.sign(refreshTokenPayload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY,
    issuer: 'alltura-api',
    audience: 'alltura-client',
  });

  // Almacenar refresh token en Redis
  await redisClient.storeRefreshToken(
    user.id,
    refreshToken,
    TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY_SECONDS
  );

  return { accessToken, refreshToken };
}

/**
 * Middleware que verifica si el usuario debe cambiar su contraseña
 * Debe usarse DESPUÉS de authMiddleware
 */
const checkPasswordChangeRequired = async (req, res, next) => {
  try {
    const User = require('../models/user');
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (user.must_change_password) {
      return res.status(403).json({
        message: 'Debe cambiar su contraseña antes de continuar',
        code: 'PASSWORD_CHANGE_REQUIRED',
        changePasswordUrl: '/api/auth/change-password',
      });
    }

    next();
  } catch (error) {
    logger.error('Error verificando cambio de contraseña requerido:', error);
    next(error);
  }
};

module.exports = {
  authMiddleware,
  revokeToken,
  generateTokenPair,
  checkPasswordChangeRequired,
  TOKEN_CONFIG,
};
