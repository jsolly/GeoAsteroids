// Importing modules
const express = require('express');
const path = require('path');
const app = express();

// set up rate limiter: maximum of five requests per minute
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per `window` (here, per 15 minutes)
});

// apply rate limiter to all requests
app.use(limiter);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/src/index.html'));
});

app.use(express.static(path.join(__dirname, '/src')));

const listener = app.listen(process.env.PORT || 4000, function() {
  console.log('Node app is working on port ' + listener.address().port);
});
