const express = require("express");
const app = express();
const admin = require("firebase-admin");
const cors = require("cors");
const { MongoClient } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
//middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Running Doctors Portal Server");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.spl8q.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const verifyToken = async (req, res, next) => {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const idToken = req.headers?.authorization.split("Bearer ")[1];
    try {
      const decodedUser = await admin.auth().verifyIdToken(idToken);
      req.decodedEmail = decodedUser.email;
    } catch (error) {}
  }
  next();
};

const run = async () => {
  try {
    await client.connect();
    const database = client.db("doctor's_portal");
    const appointmentCollection = database.collection("appointments");
    const usersCollection = database.collection("users");

    //post appointment
    app.post("/appointments", async (req, res) => {
      const appointment = req.body;
      const result = await appointmentCollection.insertOne(appointment);
      res.send(result);
    });

    //getting all appointments
    app.get("/appointments", async (req, res) => {
      const result = await appointmentCollection.find({}).toArray();
      res.send(result);
    });

    //getting appointment with particular email
    app.get("/appointment", verifyToken, async (req, res) => {
      const email = req.query.email;
      const date = req.query.date;
      const user = req.decodedEmail;
      const result = await appointmentCollection
        .find({ email: email, date: date })
        .toArray();
      res.send(result);
    });

    //getting admin
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email: email });
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.send({ admin: isAdmin });
    });

    //post users
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    //externally made for google sign in
    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    //role play updating for admin
    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: "admin" } };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.send(result);
        } else {
          res
            .status(403)
            .send({ message: "You do not have access to make admin" });
        }
      }
    });

    //get users
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find({}).toArray();
      res.send(result);
    });
  } finally {
    // await client.close();
  }
};
run().catch(console.dir);

app.listen(port, () => {
  console.log("listening to the port ", port);
});
