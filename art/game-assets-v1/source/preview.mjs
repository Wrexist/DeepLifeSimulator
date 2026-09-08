import {serve} from './server.mjs';
const server=await serve(Number(process.env.PORT)||8096);
console.log(`DeepLife asset studio: http://127.0.0.1:${server.address().port}`);
