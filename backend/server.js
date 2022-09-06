const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5000',
    methods: ['GET', 'POST']
  }
});

app.get('/', (req, res) => {
  res.send('<h1>Hello World</h1>');
});

io.on('connection', socket => {
  socket.on('input-change', msg => {
    socket.broadcast.emit('update-input', 'Hello Socket');
  })
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});