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

const listener = app.listen(process.env.PORT || 4000, function () {
  // console.log('Node app is working on port ' + listener.address().port);
});
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.use((req: Request, res: Response) => {
  res.status(404).render('404Page.ejs');
});
