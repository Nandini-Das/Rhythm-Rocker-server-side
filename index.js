const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if(err){
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qhdslp1.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const usersCollection = client.db("rhythmdb").collection("users");
    const classesCollection = client.db("rhythmdb").collection("classes");
    const instructorsCollection = client.db("rhythmdb").collection("instructors");
    const cartsCollection = client.db("rhythmdb").collection("carts");
    const paymentsCollection = client.db("rhythmdb").collection("payment");
   //jwt
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

      res.send({ token })
    })


 const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

  
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

	

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    
  app.patch('/users/:role/:id', async (req, res) => {
  try {
    const { role, id } = req.params;
    const validRoles = ['admin', 'instructor'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        role: role
      }
    };

    const result = await usersCollection.updateOne(filter, updateDoc);
    if (result.modifiedCount === 1) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })

    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { instructor : user?.role === 'instructor' }
      res.send(result);
    })
    app.get('/users/student/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ student: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { student: user?.role === 'student' }
      res.send(result);
    })

    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    })

    app.get('/classes', async(req, res) =>{
        const result = await classesCollection.find().toArray();
        res.send(result);
    })
    app.get('/classes/:id', async(req, res) =>{
      const result = await classesCollection.find().toArray();
      res.send(result);
  })
  app.get('/classes/:id', async (req, res) => {
    const { id } = req.params;
  
    try {
      const classData = await classesCollection.findOne({ _id: new ObjectId(id) });
  
      if (classData) {
        res.send(classData);
      } else {
        res.status(404).json({ error: 'Class not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
 // create payment intent
 app.post('/create-payment-intent', verifyJWT, async (req, res) => {
  const { price, description } = req.body;
  const amount = price * 100;
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: 'usd',
    description: description, 
    payment_method_types: ['card']
  });

  res.send({
    clientSecret: paymentIntent.client_secret
  });
});


  
    app.get('/classes', async (req, res) => {
      try {
        const classes = await classesCollection.find().toArray();
        res.status(200).json(classes);
      } catch (error) {
        res.status(500).json({ message: 'Error fetching classes', error: error.message });
      }
    });
    
    app.patch('/classes/:id', async (req, res) => {
      try {
        const { status, feedback } = req.body;
        const { id } = req.params;
        const validStatus = ['approved', 'denied'];
        const sendFeedback = ['   '];
    
        if (!validStatus.includes(status) || !sendFeedback.includes(feedback)) {
          return res.status(400).json({ error: 'Invalid status or feedback' });
        }
        
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            status: status,
            feedback: feedback,
          },
        };
   
        const result = await classesCollection.updateOne(filter, updateDoc);
    
        if (result.modifiedCount === 1) {
          res.json({ success: true });
        } else {
          res.status(404).json({ error: 'Class not found' });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
    
    app.delete("/classes/:id", async (req, res) => {
      const id = req.params.id;
    
      try {
        const result = await classesCollection.deleteOne({ _id: id });
        res.send({ deletedCount: result.deletedCount });
      } catch (error) {
        console.error("Error deleting class:", error);
        res.status(500).send({ error: true, message: "Internal server error" });
      }
    });
    

    app.post('/classes', async (req, res) => {
      const newItem = req.body;
      const result = await classesCollection.insertOne(newItem)
      res.send(result);
    })
    app.get('/instructors', async(req, res) =>{
        const result = await instructorsCollection.find().toArray();
        res.send(result);
    })

    app.get('/carts', verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if(email !== decodedEmail){
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
      const query = { email: email };
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    }); 

    app.post('/carts', async (req, res) => {
      const item = req.body;
      const result = await cartsCollection.insertOne(item);
      res.send(result);
    })

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    })
    app.patch('/classes/:id', (req, res) => {
      const { id } = req.params;
      const { available_seats } = req.body;
    
      // Validate input
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid class ID' });
      }
    
      // Assuming you have a MongoDB connection
      const classesCollection = db.collection('classes');
    
      // Update the class document
      classesCollection
        .updateOne(
          { _id: ObjectId(id) },
          { $set: { available_seats: available_seats } }
        )
        .then((result) => {
          if (result.modifiedCount === 1) {
            res.json({ success: true });
          } else {
            res.status(404).json({ error: 'Class not found' });
          }
        })
        .catch((error) => {
          console.error(error);
          res.status(500).json({ error: 'Internal server error' });
        });
    });
  
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        description: 'Payment for Classes', // Add a description for the payment intent
        payment_method_types: ['card']
      });
    
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })
    app.post('/payment', async (req, res) => {
      const item = req.body;
      const result = await paymentsCollection.insertOne(item);
      res.send(result);
    })
    app.get('/payment', async(req, res) =>{
        const result = await paymentsCollection.find().toArray();
        res.send(result);
    })
    
    
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Server is running')
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})