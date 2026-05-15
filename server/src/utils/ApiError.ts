//A custom error class that carries an HTTP status code.
//This lets us throw typed errors anywhere in the app and have the
//error middleware handle them uniformly, without scattering
//res.status(400).json(...) calls across every file.

export class ApiError extends Error {
    public readonly statusCode:number;
    public readonly isOperational: boolean;

    constructor(
        statusCode:number,
        message:string,
        isOperational=true //operational=expected error (400,401,404,429)
                           //non-operations = programmer error (500) - should alert
    ) {
        super(message);

        this.statusCode = statusCode;
        this.isOperational = isOperational;
        
        //Maintains correct stack trace in V8 (Node.js)
        Error.captureStackTrace(this,this.constructor);
        Object.setPrototypeOf(this,ApiError.prototype);
    }

    //Convenience factories - self-documenting at the call site
    static badRequest(message:string) {
        return new ApiError(400,message);
    }

    static unauthorized(message:string="Unauthorized") {
        return new ApiError(401,message);
    }

    static forbidden(message:string="Forbidden") {
        return new ApiError(403,message);
    }

    static notFound(message:string="Not Found") {
        return new ApiError(404,message);
    }

    static tooManyRequests(message:string="Too many requests") {
        return new ApiError(429,message);
    }

    static internal(message:string = "Internal server error") {
        return new ApiError(500, message,false);
    }
}