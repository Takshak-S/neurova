import  {Request, Response, NextFunction, RequestHandler} from "express";

// Without this wrapper, every async route handler needs its own try/catch.
// This HOF (higher-order function) wraps any async handler and forwards
// any thrown error to Express's next() — which routes it to our error middleware.
//
// Usage:
//   router.post('/send-otp', asyncHandler(authController.sendOTP));
//
// Instead of:
//   router.post('/send-otp', async (req, res, next) => {
//     try { await authController.sendOTP(req, res, next); }
//     catch (err) { next(err); }
//   });
export const asyncHandler = (fn:RequestHandler):RequestHandler=>{
    return (req:Request, res:Response, next: NextFunction):void=>{
        Promise.resolve(fn(req,res,next)).catch(next);
    }
}
