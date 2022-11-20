const express = require('express');
const http = require('http');
const {
  Server
} = require('socket.io');
const router = express.Router();

const port = process.env.PORT || 3000;

let rooms = {};

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

    console.log("\n### J O I N ###", rooms)
  })

  socket.on('leave', (roomId, userId) => {
    if (userId == null || rooms[roomId] == null) {
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

    console.log("\n### L E A V E ###\n", rooms)
  })

  socket.on('change-source', (roomId, userId, showAlt) => {
    if (rooms[roomId] == null) {
      return;
    }

    const targetConnectionId = rooms[roomId].users
      .find(user => user.janusId === userId)
      .socketId;

    socket.to(targetConnectionId).emit('switch-stream', rooms[roomId].host.janusId, showAlt)
  })
});

app.use("/socket", router);

server.listen(port, () => {
  console.log(`listening on *:${port}`);
});