// Importing modules
const express = require('express');
const path = require('path');
var favicon = require('serve-favicon')
const app = express();

// set up rate limiter: maximum of five requests per minute
var rateLimit = require('express-rate-limit')
var limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
});

// apply rate limiter to all requests
app.use(limiter);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/public/home.html'));
});


app.use(favicon(path.join(__dirname, '/public', 'favicon.ico')))
app.use(express.static(path.join(__dirname, '/public')));

app.listen(process.env.PORT || 4000, function () {
    console.log('Node app is working!');
});