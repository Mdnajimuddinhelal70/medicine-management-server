const express = require("express");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 8000;

//middlewares
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9b7hvrr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const medicineCollection = client
      .db("medicinesDb")
      .collection("myMedicine");
    const usersCollection = client.db("medicinesDb").collection("users");
    const cartsCollection = client.db("medicinesDb").collection("carts");
    const paymentCollection = client.db("medicinesDb").collection("payments");

    // JWT Token Generation
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // JWT Middleware
    const verifyToken = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = authHeader.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // Verify Admin Middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };

    // Users Related APIs
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Unauthorized access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      res.send({ admin: isAdmin });
    });

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    app.patch("/users/admin/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: { role: "admin" } };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Make Seller API
    app.patch(
      "/users/seller/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { role: "seller" } };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );
    app.patch(
      "/users/user/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { role: "user" } };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );

    app.get("/payment-history", verifyToken, async (req, res) => {
      try {
        const { email } = req.query;
        const payments = await paymentCollection.find({ email }).toArray();
        res.send(payments);
      } catch (error) {
        res.status(500).send({ message: "Error fetching payment history." });
      }
    });
    

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    //TODO:
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });

    // Medicines Related APIs
    app.get("/myMedicine", async (req, res) => {
      const medicines = await medicineCollection.find().toArray();
      res.send(medicines);
    });

    app.get("/myMedicine", async (req, res) => {
      const sellerEmail = req.user.email;
      const medicines = await medicineCollection
        .find({ sellerEmail })
        .toArray();
      res.send(medicines);
    });

    app.post("/myMedicine", verifyToken, async (req, res) => {
      try {
        const {
          name,
          image,
          category,
          price,
          description,
          type,
          dosage,
          noOfMedicines,
          company,
          quantity,
          email,
        } = req.body;
       

        const newMedicine = {
          name,
          image,
          category,
          price,
          description,
          type,
          dosage,
          noOfMedicines,
          company,
          quantity,
          email,
        };

        // Insert new medicine into the database
        await medicineCollection.insertOne(newMedicine);
        res.status(201).send("Medicine added successfully");
      } catch (error) {
        console.error("Error adding medicine:", error);
        res.status(500).send("Error adding medicine");
      }
    });

    // Carts Related APIs
    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartsCollection.insertOne(cartItem);
      res.send(result);
    });

    app.get("/carts", async (req, res) => {
      const carts = await cartsCollection.find().toArray();
      res.send(carts);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const { quantity } = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = { $set: { quantity: quantity } };
      const result = await cartsCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Payment Related APIs
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      if (typeof price !== "number" || price <= 0) {
        return res.status(400).send({ error: "Invalid price value" });
      }
      const amount = Math.round(price * 100);
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(500).send({ error: "Payment processing failed" });
      }
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      const query = {
        _id: {
          $in: payment.cartIds.map((id) => new ObjectId(id)),
        },
      };
      const deleteResult = await cartsCollection.deleteMany(query);
      res.send({ paymentResult, deleteResult });
    });

    app.get("/payments/:email", async (req, res) => {
      const query = { email: req.params.email };
      const payments = await paymentCollection.find(query).toArray();
      res.send(payments);
    });

    // Get all payments (admin route)
    app.get("/payments", verifyToken, verifyAdmin, async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    // Update payment status to "paid"
    app.patch("/payments/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const updateDoc = { $set: { status: "paid" } };
      const filter = { _id: new ObjectId(id) };
      const result = await paymentCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Add a new category
    app.post("/myMedicine", async (req, res) => {
      const category = req.body;
      const result = await medicineCollection.insertOne(category);
      res.send(result);
    });

    // Update a category
    app.patch("/myMedicine/:id", async (req, res) => {
      const id = req.params.id;
      const category = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: category };
      const result = await medicineCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Delete a category
    app.delete("/myMedicine/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await medicineCollection.deleteOne(filter);
      res.send(result);
    });

    //Stats
    app.get("/admin-stats", async (req, res) => {
      try {
        const users = await usersCollection.estimatedDocumentCount();
        const medicineItems = await medicineCollection.estimatedDocumentCount();
        const orders = await paymentCollection.estimatedDocumentCount();

        // Calculate total revenue from paid orders
        const revenueResult = await paymentCollection
          .aggregate([
            {
              $match: { status: "paid" }, // Match only paid orders
            },
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: { $toDouble: "$price" } }, // Ensure price is converted to number
              },
            },
          ])
          .toArray();
        const revenue =
          revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

        // Calculate total paid
        const paidTotalResult = await paymentCollection
          .aggregate([
            {
              $match: { status: "paid" },
            },
            {
              $group: {
                _id: null,
                totalPaid: { $sum: { $toDouble: "$price" } },
              },
            },
          ])
          .toArray();
        const totalPaid =
          paidTotalResult.length > 0 ? paidTotalResult[0].totalPaid : 0;

        // Calculate total pending
        const pendingTotalResult = await paymentCollection
          .aggregate([
            {
              $match: { status: "pending" },
            },
            {
              $group: {
                _id: null,
                totalPending: { $sum: { $toDouble: "$price" } },
              },
            },
          ])
          .toArray();
        const totalPending =
          pendingTotalResult.length > 0
            ? pendingTotalResult[0].totalPending
            : 0;

        res.send({
          users,
          medicineItems,
          orders,
          revenue,
          totalPaid,
          totalPending,
        });

        //<============================= //apis for seller ===================================>
        app.get("/seller-stats", async (req, res) => {
          const sellerEmail = req.query.email; // Email sent from the frontend as a query parameter

          const paidResult = await paymentCollection
            .aggregate([
              {
                $match: { sellerEmail, status: "paid" },
              },
              {
                $group: {
                  _id: null,
                  totalPaidRevenue: { $sum: "$price" },
                },
              },
            ])
            .toArray();
          const totalPaidRevenue =
            paidResult.length > 0 ? paidResult[0].totalPaidRevenue : 0;

          const pendingResult = await paymentCollection
            .aggregate([
              {
                $match: { sellerEmail, status: "pending" },
              },
              {
                $group: {
                  _id: null,
                  totalPendingRevenue: { $sum: "$price" },
                },
              },
            ])
            .toArray();
          const totalPendingRevenue =
            pendingResult.length > 0 ? pendingResult[0].totalPendingRevenue : 0;

          res.send({
            totalPaidRevenue,
            totalPendingRevenue,
          });
        });
      } catch (err) {
        console.error(err);
        res
          .status(500)
          .send({ error: "An error occurred while fetching admin stats" });
      }
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Optional: Clean up resources if needed
  }
}
run().catch(console.dir);

// Root Route and Server Listener
app.get("/", (req, res) => {
  res.send("Medicines project is running");
});

app.listen(port, () => {
  console.log(`Medicines project is running on port ${port}`);
});
