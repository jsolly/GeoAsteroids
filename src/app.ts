// Importing modules
import express, { Application, Request, Response } from 'express';
const app: Application = express();
import path from 'path';

// Register View Engine
app.set('view engine', 'ejs');

// set up rate limiter: maximum of five requests per minute
import rateLimit from 'express-rate-limit';
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50000, // Limit each IP to 500 requests per `window` (here, per 15 minutes)
});
// apply rate limiter to all requests
app.use(limiter);

app.listen(4000, () => console.log('Server Running!'));

app.get('/', (req: Request, res: Response) => {
  res.sendFile('built/main.js', { root: __dirname });
  res.render('index');
});

app.use(express.static(path.join(__dirname, '/built')));

app.use((req: Request, res: Response) => {
  res.status(404).render('404Page.ejs');
});
