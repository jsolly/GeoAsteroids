// Importing modules
const express = require('express');
const path = require('path');
var favicon = require('serve-favicon')
const PORT = process.env.PORT || 5000
const app = express();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/public/home.html'));
});


app.use(favicon(path.join(__dirname, '/public', 'favicon.ico')))
app.use(express.static(path.join(__dirname, '/public')));

app.listen(PORT, () => console.log(`Listening on ${ PORT }`))