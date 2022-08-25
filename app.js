// Importing modules
const express = require('express');
const app = express();
const path = require('path');

// Register View Engine
app.set('view engine', 'ejs');

// set up rate limiter: maximum of five requests per minute
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50000, // Limit each IP to 500 requests per `window` (here, per 15 minutes)
});
// apply rate limiter to all requests
app.use(limiter);

const listener = app.listen(process.env.PORT || 4000, function () {
  console.log('Node app is working on port ' + listener.address().port);
});

app.get('/', (req, res) => {
  res.sendFile('built/index.html', { root: __dirname });
});

app.use(express.static(path.join(__dirname, '/built')));

app.use((req, res) => {
  res.status(404).sendFile('built/404Page.html', { root: __dirname });
});
