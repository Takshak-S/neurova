// Every successful API response has the same envelope shape:
// { success: true, message: "...", data: { ... } }
//
// This consistency makes the frontend predictable — it always knows
// where to find the data and whether the request succeeded.

export class ApiResponse<T = unknown> {
    public readonly success:boolean;
    public readonly message:string;
    public readonly data:T;

    constructor(message:string,data:T) {
        this.success = true;
        this.message=message;
        this.data=data;
    }
}