const express = require('express');
const http = require('http');
const {
  Server
} = require('socket.io');
const router = express.Router();

let rooms = {};
let users = [];
let host = null;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  path: "/socket/socket.io",
  cors: {
    origin: '*',
  }
});

router.get('/', (req, res) => {
  res.send('<h1>Hello World</h1>');
});

io.on('connection', socket => {
  socket.on('input-change', msg => {
    // socket.broadcast.emit('update-input', 'Hello Socket');
    socket.emit('update-input', 'Hello Socket')
  })

  socket.on('join', (roomId, userId, isHost) => {
    if (userId == null || roomId == null) {
      return;
    }

    const user = {
      socketId: socket.id,
      janusId: userId
    };

    if (rooms[roomId] == null) {
      rooms[roomId] = {
        host: null,
        users: []
      }
    }

    if (isHost) {
      rooms[roomId].host = user;
    } else {
      rooms[roomId].users = [...rooms[roomId].users, user]
    }

    // if (isHost) {
    //   host = {
    //     socketId: socket.id,
    //     janusId: userId
    //   };
    // } else {
    //   users = [...users, {
    //     socketId: socket.id,
    //     janusId: userId
    //   }];
    // }

    console.log("\n### J O I N ###", rooms)
  })

  socket.on('leave', (roomId, userId) => {
    if (userId == null) {
      return;
    }

    if (rooms[roomId].host && rooms[roomId].host.janusId === userId) {
      rooms[roomId].host = null;
    } else {
      rooms[roomId].users = rooms[roomId].users.filter(user => user.janusId !== userId)
    }

    if (rooms[roomId].host == null && rooms[roomId].users.length === 0) {
      delete rooms[roomId];
    }

    // if (host === userId) {
    //   host = null;
    // } else {
    //   users = users.filter(({
    //     janusId
    //   }) => janusId !== userId);
    // }

    console.log("\n### L E A V E ###\n", rooms)
  })

  socket.on('change-source', (roomId, userId, showAlt) => {
    const targetConnectionId = rooms[roomId].users
      .find(user => user.janusId === userId)
      .socketId;

    console.log("target connection id", targetConnectionId);

    // const targetConnectionId = users.filter(({
    //   janusId
    // }) => janusId === userId)[0].socketId;

    socket.to(targetConnectionId).emit('switch-stream', rooms[roomId].host.janusId, showAlt)
  })
});

app.use("/socket", router);

server.listen(3000, () => {
  console.log('listening on *:3000');
});