import {Server, Socket} from "socket.io";
import {Server as HTTPSServer} from "https";

export const initSocket = (server:HTTPSServer) => {
    const io = new Server(server, {
        cors:{
            origin:"*"
        },
    });

    io.on("connection", (socket:Socket)=>{
        console.log("A user connected:", socket.id);

        socket.on("send_message",(data:{message:string})=>{
            socket.broadcast.emit("receive_message", data);
        }) 

        socket.on("disconnect", ()=>{
            console.log("User disconnected");
        })
    })
};