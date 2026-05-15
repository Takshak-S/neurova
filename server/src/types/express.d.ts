import { IUser } from "../models/User.model";

//Extends Express's Request interface globally.
//This is what lets us write req.user in controllers and middleware
//without TypeScript complaining that the property doesn't exist.
declare global {
    namespace Express {
        interface Request {
            user?: IUser;
        }
    }
}
