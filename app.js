// Importing modules
const express = require('express');
const path = require('path');
const app = express();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/public/home.html'));
});

app.use(express.static(path.join(__dirname, '/public')));

app.listen(3000, () => {
    console.log('Server is up on port 3000');
});
