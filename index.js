import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import dayjs from "dayjs";
import joi from "joi";
import { MongoClient } from "mongodb";

const app = express();
app.use(cors());
dotenv.config();
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect().then(() => {
  db = mongoClient.db("batepapo_uol");
  console.log("Conectado ao banco de dados com sucesso");
});

app.post("/participants", async (req, res) => {
  const { name } = req.body;

  const userSchema = joi.object({
    name: joi.string().required(),
  });

  const validation = userSchema.validate(req.body);

  if (validation.error) {
    res.sendStatus(422);
    return;
  }

  try {
    const userExists = await db
      .collection("participants")
      .findOne({ name: name });

    if (userExists) {
      res.status(409).send("Nome de usuário já existente");
      return;
    }

    await db
      .collection("participants")
      .insertOne({ name: name, lastStatus: Date.now() });

    await db.collection("messages").insertOne({
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
    res.sendStatus(201);
  } catch (e) {
    res.sendStatus(500);
    console.log("deu ruim", e);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const users = await db.collection("participants").find().toArray();
    res.send(users);
  } catch (e) {
    res.status(500).send("Não foi possível encontrar os usuários");
    console.log("deu erro", e);
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const user = req.headers.user;

  const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.required().valid("message", "private_message"),
    from: joi.string().required(),
  });

  const validation = messageSchema.validate(req.body, user);

  if (validation.error) {
    res.status(422).send("Não foi possível enviar a mensagem");
    return;
  }

  try {
    const checkUser = await db
      .collection("participants")
      .find({ name: user })
      .toArray();

    if (!checkUser) {
      res.sendStatus(422);
      return;
    }

    const time = dayjs().format("HH:mm:ss");

    await db.collection("messages").insertOne({
      from: user,
      to: to,
      text: text,
      type: type,
      time: time,
    });
    res.sendStatus(201);
  } catch(e) {
    console.log("deu erro", e);
    res.status(500);
  }
});

app.get("/messages", async (req, res) => {
  const limit = req.query.limit;
  const user = req.headers.user;

  try {
    const allMessages = await db.collection("messages").find({}).toArray();
    const messagesFilter = allMessages.filter((message) => {
      return (
        message.to === user || message.from === user || message.to === "Todos"
      );
    });

    if (!limit) {
      res.send(messagesFilter);
    } else {
      res.send(messagesFilter.slice(-limit));
    }
  } catch (e) {
    res.sendStatus(500);
    console.log("deu erro", e);
  }
});

app.post("/status", async (req, res) => {
  const user = req.headers.user;

  try {
    const checkUser = await db
      .collection("participants")
      .findOne({ name: user });
    if (!checkUser) {
      res.sendStatus(404);
      return;
    }

    await db
      .collection("participants")
      .updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
    res.sendStatus(200);
  } catch (e) {
    console.log("deu erro", e);
    res.sendStatus(500);
  }
});

//TODO: Remoção de usuários inativos

app.listen(5000, () => console.log("Server working"));
