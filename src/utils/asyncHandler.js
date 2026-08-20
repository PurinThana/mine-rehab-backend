// Wrap an async (req, res, next) handler so any rejected promise is
// forwarded to Express's error middleware instead of crashing the process.
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}
