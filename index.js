const express = require('express');
const app = express();
require('dotenv').config()
const cors = require('cors');
const port = process.env.PORT || 8000;


//middlewares
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9b7hvrr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
  
async function run() {
  try {
   const medicineCollection = client.db('medicinesDb').collection('medicines')

   app.get('/medicines', async(req, res) => {
    const result = await medicineCollection.find().toArray();
    res.send(result)
   });
   
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
   
  }
}
run().catch(console.dir);






app.get('/', (req, res) => {
    res.send('medicines project is running')
});

app.listen(port, () => {
    console.log(`Medicines project is running on port ${port}`)
})