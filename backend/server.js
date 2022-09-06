const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

let users = [];
let host = null;

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

  socket.on('join', (userId, isHost) => {
    if (userId == null) {
      return;
    }

    if (isHost) {
      host = userId;
    } else {
      users = [...users, userId];
    }

    console.log("### join ###\nhost:", host, "users", users)
  })

  socket.on('leave', userId => {
    if (userId == null) {
      return;
    }

    if (host === userId) {
      host = null;
    } else {
      users = users.filter(id => id !== userId);
    }

    console.log("### leave ###\nhost:", host, "users", users)
  })
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});