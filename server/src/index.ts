import express from "express";
import https from "https";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();


const app = express();
app.use(cors());
app.use(express.json());
const server = https.createServer({
    key: fs.readFileSync("localhost-key.pem"),
    cert: fs.readFileSync("localhost.pem")
},app);

const PORT = process.env.PORT || 5000;

server.listen(PORT,()=>{
    console.log(`Server running in ${PORT}`);
})