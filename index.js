const express = require("express");
const app = express();
require("dotenv").config();
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
    const medicineCollection = client.db("medicinesDb").collection("myMedicine");
    const usersCollection = client.db("medicinesDb").collection("users");
    const cartsCollection = client.db("medicinesDb").collection("carts");
    const paymentCollection = client.db("medicinesDb").collection("payments");


    //users related api
    app.get('/users', async(req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    });
    //api for making admin
    app.patch('/users/admin/:id', async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedDoc = {
        $set:{
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc)
      res.send(result)
    });

    app.post('/users', async(req, res) => {
      const user = req.body;
      const query = {email: user.email}
      const existingUser = await usersCollection.findOne(query)
      if(existingUser){
        return res.send({message: 'user already exists', insertedId: null})
      }
      const result = await usersCollection.insertOne(user);
      res.send(result)
    });
    
    app.get("/myMedicine", async (req, res) => {
      const result = await medicineCollection.find().toArray();
      res.send(result);
    });

    // carts related apis
    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartsCollection.insertOne(cartItem);
      res.send(result);
    });
    app.get("/carts", async (req, res) => {
      const result = await cartsCollection.find().toArray();
      res.send(result);
    });
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    });

    //Upaadte quantity
    app.patch("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const { quantity } = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { quantity: quantity },
      };
      const result = await cartsCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    // payment related api
   
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
     
      if (typeof price !== 'number' || price <= 0) {
        console.log(price);
        return res.status(400).send({ error: "Invalid price value" });
      }  
      const amount = Math.round(price * 100); 
      try {  
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });    
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.error("Payment Intent Error:", error);
        res.status(500).send({ error: "Payment processing failed" });
      }
    });
    


    app.post('/payments', async(req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      const query = {_id: {
        $in: payment.cartIds.map(id => new ObjectId(id))
      }};
      const deleteResult = await cartsCollection.deleteMany(query)
      res.send({paymentResult, deleteResult})
    });

     app.get('/payments/:email', async(req, res) => {
      const query = {email: req.params.email}
      const result = await paymentCollection.find(query).toArray();
      res.send(result)
     })

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("medicines project is running");
});

app.listen(port, () => {
  console.log(`Medicines project is running on port ${port}`);
});
