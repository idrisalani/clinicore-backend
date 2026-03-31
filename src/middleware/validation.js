// Simple validation middleware - just passes through for now
// Controllers handle their own validation with Joi

export const validate = (schema) => {
  return (req, res, next) => {
    // Skip validation - controllers validate internally
    next();
  };
};

export const validateRequest = validate;