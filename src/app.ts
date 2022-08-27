// Importing modules
// import express, { Application, Response } from 'express';
// const app: Application = express();
// import path from 'path';

// // set up rate limiter: maximum of five requests per minute
// import rateLimit from 'express-rate-limit';
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 500, // Limit each IP to 500 requests per `window` (here, per 15 minutes)
// });
// // apply rate limiter to all requests
// app.use(limiter);

// app.listen(process.env.PORT || 4000, function () {
//   // console.log(`Node app is working on port ${listener.address().port}`);
// });
// app.use(express.static(path.join(__dirname, '../public')));

// app.get('/', (res: Response) => {
//   res.sendFile(path.join(__dirname, 'public/index.html'));
// });

// app.use((res: Response) => {
//   res.sendFile(path.join(__dirname, 'public/404Page.html'));
// });
