const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { PORT = 5001 } = process.env;
const net = require('net');

const socketPath = process.env.SOCKET_PATH || '/tmp/socket.sock';
const app = express();
app.use(bodyParser.json());
app.use(cors());
const router = express.Router();
let client = net.createConnection({ path: socketPath });
router.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});
router.post('/attempt/enter', (req, res) => {
  const randomTag = Math.floor(Math.random() * 1000);
  client = net.createConnection({ path: socketPath });
  client.write(
    JSON.stringify({ type: 'EnterAttempt', tag: randomTag, data: req.body }) + '\0'
  );

  client.on('data', (data) => {
    client.end();
    res.send(data.subarray(0, data.length - 1)); // -1 because of null byte
  });
});
router.post('/device/connect', (req, res) => {
  const randomTag = Math.floor(Math.random() * 1000);
  client = net.createConnection({ path: socketPath });
  client.write(
    JSON.stringify({
      type: 'RequestToConnectDevice',
      tag: randomTag,
      data: req.body,
    }) + '\0'
  );
  client.on('data', (data) => {
    client.end();
    res.send(data.subarray(0, data.length - 1)); // -1 because of null byte
  });
});

client.on('connect', () => {
  console.log('Connected to Unix socket server');
});

client.on('data', (data) => {
  console.log('Received response from server:', data.toString());
});

client.on('error', (err) => {
  console.error('Error:', err);
});

app.use(router);

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT} ...`);
});
