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
  // With a root, a dot folder higher up the path isn't refused
  res.sendFile('index.html', { root: __dirname });
});

/** Sends a packet and answers with the reply carrying its tag */
const sendToSocket = (type, body, res) => {
  const tag = Math.floor(Math.random() * 1000);
  const connection = net.createConnection({ path: socketPath });
  let buffer = '';
  connection.write(JSON.stringify({ type, tag, data: body }) + '\0');

  connection.on('data', (chunk) => {
    buffer += chunk;
    const packets = buffer.split('\0');
    buffer = packets.pop();
    // The server also sends broadcasts, like its status, down this connection
    const reply = packets.find((packet) => JSON.parse(packet).tag === tag);
    if (reply) {
      connection.end();
      res.send(reply);
    }
  });
  connection.on('error', (err) => {
    res.status(502).send({ error: err.message });
  });
};

router.post('/attempt/enter', (req, res) => {
  sendToSocket('EnterAttempt', req.body, res);
});
router.post('/person/info', (req, res) => {
  sendToSocket('PersonInfo', req.body, res);
});
router.post('/device/connect', (req, res) => {
  sendToSocket('RequestToConnectDevice', req.body, res);
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
