/**
 * Barrel de compatibilidad para helpers de validación.
 * Permite importar desde una única entrada sin romper imports existentes.
 */

const sharedSchemas = require('./sharedSchemas');
const customValidators = require('./customValidators');

module.exports = {
  ...sharedSchemas,
  ...customValidators,
  sharedSchemas,
  customValidators,
};
