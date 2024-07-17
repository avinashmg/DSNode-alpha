const express = require("express");
const cors = require("cors");
const fs = require("fs");
const multer = require("multer");
const { PrismaClient } = require("@prisma/client");
const { timeStamp } = require("console");
const axios = require("axios").default;
const WebSocket = require("ws");

const prisma = new PrismaClient();

const app = express();
const port = 3000;
app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "files/");
  },
  filename: function (req, file, callback) {
    callback(null, file.originalname);
  },
});

const upload = multer({ storage: storage });
app.use("/files", express.static("files"));

//Middleware to find get the profile
const profilecode = (req, res, next) => {
  let hostname = req.hostname;
  if (req.hostname === "localhost") {
    hostname = `${req.hostname}.${req.socket.localPort}`;
  }
  req.profilecode = hostname;
  next();
};
app.use(profilecode);

app.post("/file_upload", upload.array("files"), async (req, res) => {
  res.status(200).send();
});

app.get("/", async (req, res) => {
  let hostname = req.profilecode;
  try {
    let data = await fs.promises.readFile(`./profile/${hostname}.json`, "utf8");
    data = JSON.parse(data);
    delete data.password;
    data.profile["online"] = is_online(req.hostname);
    res.json(data);
  } catch (error) {
    console.log(error);
    res.status(400).send();
  }
});

app.post("/sign_in", async (req, res) => {
  let data = await fs.promises.readFile(
    `./profile/${req.profilecode}.json`,
    "utf8"
  );
  data = JSON.parse(data);
  if (data.password == req.body.password) {
    res.json({ token: "token" });
  } else {
    res.status(400).send();
  }
});

app.put("/profile", async (req, res) => {
  let file = await fs.promises.readFile(
    `./profile/${req.profilecode}.json`,
    "utf8"
  );
  file = JSON.parse(file);
  file.profile = req.body.profile;
  fs.promises.writeFile(
    `./profile/${req.profilecode}.json`,
    JSON.stringify(file)
  );
  res.status(200).send();
});

app.post("/post", async (req, res) => {
  const result = await prisma.posts.create({
    data: {
      post_type: req.body.post_type,
      post_text: req.body.post_text,
      host: req.hostname,
    },
    select: {
      id: true,
    },
  });
  let data = await fs.promises.readFile(
    `./profile/${req.hostname}.json`,
    "utf8"
  );
  data = JSON.parse(data);
  send_to_followers(
    req.hostname,
    data.profile.username,
    `${data.profile.username}/p/${result.id}`
  );
  res.status(200).json({ success: true });
});

app.get("/posts/", async (req, res) => {
  let hostname = req.hostname;
  const result = await prisma.posts.findMany({
    where: {
      host: hostname,
    },
    orderBy: {
      id: "desc",
    },
  });
  res.json(result);
});

app.get("/p/:post_id", async (req, res) => {
  const reply = await prisma.posts.findMany({
    where: {
      id: parseInt(req.params.post_id),
    },
  });
  let data = await fs.promises.readFile(
    `./profile/${req.profilecode}.json`,
    "utf8"
  );
  data = JSON.parse(data);
  reply[0].dp = data.profile.profile_image;
  reply[0].fullname = data.profile.fullname;
  reply[0].verified = data.profile.verified;
  res.json(reply);
});

app.get("/like/", async (req, res) => {
  const result = await prisma.likes.findMany({
    where: {
      post_id: req.query.id,
      host: req.hostname,
    },
  });
  if (result.length === 1) {
    res.status(200).send();
  } else {
    res.status(300).send();
  }
});

app.post("/like/", async (req, res) => {
  const post_id = req.body.post;
  const result = await prisma.likes.create({
    data: {
      post_id: post_id,
      host: req.hostname,
    },
  });
  res.status(200).json({ success: true });
});

app.post("/unlike/", async (req, res) => {
  const post_id = req.body.post;
  const result = await prisma.likes.deleteMany({
    where: {
      post_id: post_id,
      host: req.hostname,
    },
  });
  res.status(200).json({ success: true });
});

app.get("/u/:username/p/:post_id/replies", async (req, res) => {
  const result = await prisma.replyRelations.findMany({
    where: {
      parent: `/u/${req.params.username}/p/${req.params.post_id}`,
    },
  });
  res.json(result);
});

app.get("/r/:reply_id", async (req, res) => {
  console.log(req.params.reply_id);
  const reply = await prisma.replies.findMany({
    where: {
      id: parseInt(req.params.reply_id),
    },
  });
  let data = await fs.promises.readFile(
    `./profile/${req.profilecode}.json`,
    "utf8"
  );
  data = JSON.parse(data);
  reply[0].dp = data.profile.profile_image;
  reply[0].fullname = data.profile.fullname;
  reply[0].verified = data.profile.verified;
  res.json(reply);
});

app.post("/reply", async (req, res) => {
  let parent = req.body.parent;
  parent = parent.split("/");
  let username;
  for (let i = 0; i < parent.length; i++) {
    if (parent[i] == "u") {
      username = parent[i + 1];
    }
  }
  const result = await prisma.replies.create({
    data: {
      reply_type: req.body.reply_type,
      reply_text: req.body.reply_text,
      parent: req.body.parent,
    },
    select: {
      id: true,
    },
  });
  //send the comment to the parent
  const address = await address_from_username(username);

  const value = JSON.stringify({
    reply_id: `/r/${result.id}`,
    reply_parent: req.body.parent,
  });
  var options = {
    method: "POST",
    url: `https://${address}/signal/`,
    headers: { Accept: "*/*", "Content-Type": "application/json" },
    data: { type: "add_reply", value: value, from: req.body.from },
  };
  axios
    .request(options)
    .then(function (response) {
      console.log(response.data);
    })
    .catch(function (error) {
      console.error(error);
    });
  res.status(200).json({ success: true });
});

app.get("/following/", async (req, res) => {
  const result = await prisma.following.findMany({
    where: {
      host: req.hostname,
    },
    select: {
      username: true,
    },
    distinct: ["username"],
  });
  res.json(result);
});

app.get("/followers", async (req, res) => {
  const result = await prisma.followers.findMany({
    where: {
      host: req.hostname,
    },
    select: {
      username: true,
    },
    distinct: ["username"],
  });
  res.json(result);
});

app.post("/follow_id/", async (req, res) => {
  let data = await fs.promises.readFile(
    `./profile/${req.profilecode}.json`,
    "utf8"
  );
  data = JSON.parse(data);
  var options = {
    method: "POST",
    url: `https://${req.body.address}/follow_req/`,
    headers: { Accept: "*/*", "Content-Type": "application/json" },
    data: { username: data.profile.username },
  };
  console.log(data.profile.username);

  try {
    const response = await axios.request(options);
    if (response.data.success) {
      console.log("HURAY");
      console.log(req.body);
      try {
        const result = await prisma.following.create({
          data: {
            username: req.body.username,
            host: req.hostname,
          },
          select: {
            id: true,
          },
        });
        res.status(200).json({ success: true, id: result.id });
      } catch (error) {
        console.error(error);
        res.status(200).json({ success: false });
      }
    } else {
      res.status(200).json({
        success: false,
        message: "remote server rejected or not reachable",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(200).json({ success: false, message: error.response });
  }
});

app.post("/follow_req", async (req, res) => {
  console.log(req.body);
  const result = await prisma.followers.create({
    data: {
      username: req.body.username,
      host: req.hostname,
    },
    select: {
      id: true,
    },
  });
  res.status(200).json({ success: true, id: result.id });
});

app.post("/unfollow_id/", async (req, res) => {
  const result = await prisma.following.deleteMany({
    where: {
      username: req.body.username,
      host: req.hostname,
    },
  });
  res.status(200).json({ success: true });
});

app.get("/following", async (req, res) => {
  console.log(req.query);
  const result = await prisma.following.findMany({
    where: {
      username: req.query.id,
      host: req.hostname,
    },
    select: {
      id: true,
    },
  });
  console.log("following", result);
  res.json(result.length > 0 ? true : false);
});

app.get("/feeds", async (req, res) => {
  console.log(req.query);
  const result = await prisma.signals.findMany({
    where: {
      type: "new post",
      host: req.hostname,
    },
    orderBy: {
      timestamp: "desc",
    },
  });
  res.json(result);
});

app.post("/message", async (req, res) => {
  console.log(req.query);
  const result = await prisma.messages.create({
    data: {
      username: req.body.username,
      message: req.body.msg,
      host: req.hostname,
    },
    select: {
      id: true,
      timestamp: true,
    },
  });
  if (!sockets[req.hostname]) sockets[req.hostname] = [];
  sockets[req.hostname].forEach((socket) => {
    socket.send(
      JSON.stringify({
        type: "message",
        message: req.body.msg,
        room: req.body.username,
      }),
      "utf8"
    );
  });
  let data = await fs.promises.readFile(
    `./profile/${req.profilecode}.json`,
    "utf8"
  );
  res.status(200).json(result);
  data = JSON.parse(data);
  const address = await address_from_username(req.body.username);
  response = await axios.post(`https://${address}/signal/`, {
    type: "message recieved",
    value: req.body.msg,
    from: req.hostname,
  });
  console.log(respomse);
});

app.post("/get_messages", async (req, res) => {
  if (req.body.username == null) {
    const result = await prisma.messages.findMany({
      where: {
        host: req.hostname,
      },
      orderBy: {
        timestamp: "desc",
      },
      distinct: ["username"],
    });
    res.status(200).json(result);
  } else {
    const result = await prisma.messages.findMany({
      where: {
        host: req.hostname,
        username: req.body.username,
      },
    });
    res.status(200).json(result);
  }
});

app.post("/signal", async (req, res) => {
  const type = req.body.type;
  const from = req.body.from;
  const value = req.body.value;
  console.log(req.body);
  switch (type) {
    case "add_reply":
      // Add reply to the reply tree
      const reply_id = JSON.parse(value).reply_id;
      const reply_parent = JSON.parse(value).reply_parent;
      const replies = 0; //default
      const originprofile = await axios.get(`https://${req.body.from}`);
      console.log(originprofile.data);
      //A transaction that would increment the reply count on the parent, and adds the reply to the table
      const [res1, res2] = await prisma.$transaction([
        prisma.signals.create({
          data: {
            type: "add_reply",
            origin: from,
            value: value,
            host: req.hostname,
          },
        }),
        prisma.replyRelations.create({
          data: {
            parent: reply_parent,
            child: `/u/${originprofile.data.profile.username}${reply_id}`,
          },
        }),
      ]);
      res.status(200).json({ success: true });
      //   io.emit(
      //     "notification",
      //     "New Notification - Someone replied to your post"
      //   );
      break;
    case "new post":
      const result = await prisma.signals.create({
        data: {
          type: "new post",
          origin: from,
          value: value,
          host: req.hostname,
        },
      });
      res.status(200).json({ success: true });
      break;
    case "message recieved":
      // Add message to the message table
      {
        const originprofile = await axios.get(`https://${from}`);
        msg = JSON.stringify({ from: "own", msg: value });
        const res = await prisma.messages.create({
          data: {
            username: originprofile.data.profile.username,
            message: msg,
            host: req.hostname,
          },
          select: {
            id: true,
            timestamp: true,
          },
        });
      }
      break;
    default:
      break;
  }
});

const server = app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

//Create websocket server and attach to the Express app
const wss = new WebSocket.Server({ server });

let sockets = {}; //keep track of connected clients

wss.on("connection", (ws, req) => {
  const hostname = req.headers.host;
  if (sockets[hostname]) {
    sockets[hostname].push(ws);
  } else {
    sockets[hostname] = [ws];
  }

  console.log("WebSocket client connected");

  ws.on("message", (message) => {
    const buffer = Buffer.from(message);
    console.log("Received message:", buffer.toString("utf8"));
    ws.send("Echo: " + Buffer.from(`Hostname : ${hostname}`, "utf8"));
  });

  ws.on("close", () => {
    sockets[hostname] = sockets[hostname].filter((w) => w !== ws);
    console.log("WebSocket client disconnected");
  });
});

//Functions

const is_online = (host) => {
  if (!sockets[host]) return false;
  return sockets[host].length > 0;
};

const fbc = {};

const address_from_username = async (username) => {
  if (username.includes(".local")) {
    let port = username.split(".")[1];
    return `localhost:${port}`;
  } else if (username.indexOf(".") != -1) {
    return `dv.${username}`;
  } else {
    if (fbc[username.toLowerCase()] != null) return fbc[username.toLowerCase()];
    var options = {
      method: "GET",
      url: `https://cloud.appwrite.io/v1/databases/deltaverse/collections/65e0ad8edd54554dd32b/documents/${username.toLowerCase()}`,
      headers: {
        Accept: "*/*",
        "X-Appwrite-Project": "65e024a95ee72b0aad3b",
        "Content-Type": "application/json",
      },
    };

    const response = await axios.request(options);
    fbc[username.toLowerCase()] = response.data.address;
    return response.data.address;
  }
};

const send_to_followers = async (host, from, value) => {
  const address = await address_from_username(from);
  var options = {
    method: "POST",
    url: `https://${address}/signal/`,
    headers: { Accept: "*/*", "Content-Type": "application/json" },
    data: { type: "new post", value: value, from: from },
  };
  axios
    .request(options)
    .then(function (response) {})
    .catch(function (error) {
      // console.error(error);
    });
  const result = await prisma.followers.findMany({
    where: {
      host: host,
    },
    select: {
      username: true,
    },
    distinct: ["username"],
  });
  for (let i = 0; i < result.length; i++) {
    const address = await address_from_username(result[i].username);
    var options = {
      method: "POST",
      url: `https://${address}/signal/`,
      headers: { Accept: "*/*", "Content-Type": "application/json" },
      data: { type: "new post", value: value, from: from },
    };
    axios
      .request(options)
      .then(function (response) {
        console.log(response);
      })
      .catch(function (error) {
        // console.error(error);
      });
  }
};
