/**
 * asyncHandler
 * Higher-order utility to wrap express route handlers and automatically pass
 * unhandled promises/errors to next() without repetitive try/catch blocks.
 */
export const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};

export default asyncHandler;
