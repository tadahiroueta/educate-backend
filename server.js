const express = require('express');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const fs = require('fs');
const cors = require('cors');
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json()); // For parsing application/json

// connecting to the client
const client = new MongoClient("mongodb+srv://berat:678jVUqdpOYWAW8N@educate-cluster.sjx3n.mongodb.net/?appName=mongosh+2.3.1&ssl=true");
try {
    client.connect();
    console.log("Connected to MongoDB")

} catch (err) {
    console.log("Error connecting to MongoDB")
}

app.post('/api/upload_flashcardSet', async (req, res) => {
    try {
        // Extract the data from the request
        const data = req.body;
        console.log(`Received array: ${JSON.stringify(data)}`);

        // Access the flashcardSets database
        const db = client.db("flashcardSets");

        const flashcardSet = data.flashcardSets[0]; // Assume you're sending a single set
        const collection = db.collection(flashcardSet.title);

        // Insert flashcards into the collection, excluding the metadata
        for (const flashcard of flashcardSet.flashcards) {
            // Make sure flashcards are only identified by the term
            await collection.updateOne(
                { term: flashcard.term }, // Match by term (for flashcards only)
                { $set: { term: flashcard.term, definition: flashcard.definition } }, // Set only term and definition for flashcards
                { upsert: true } // Insert if not found
            );
        }

        // Now, insert the metadata separately
        const metadata = {
            metadata: true,
            id: flashcardSet.id,
            title: flashcardSet.title,
            author: flashcardSet.author,
            topic: flashcardSet.topic,
            dateCreated: flashcardSet.dateCreated,
            rating: flashcardSet.rating,
            numberOfFlashcards: flashcardSet.flashcards.length, // Count flashcards
        };

        // Update or insert the metadata document
        await collection.updateOne(
            { metadata: true }, // Make sure only the metadata document is matched
            { $set: metadata }, // Set the metadata fields
            { upsert: true } // Insert if not found
        );

        console.log(`Successfully inserted flashcard set: ${flashcardSet.title}`);
        res.json({ message: 'Flashcard set uploaded successfully!' });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ message: 'An error occurred while uploading the flashcard set' });
    }
});



app.get('/api/upload_collections', async (req, res) => {
    try {
        // read the JSON file
        const data = JSON.parse(fs.readFileSync('../src/data/sample.json', 'utf8'));

        // access the flashcardSets db
        const db = client.db("flashcardSets");

        for (const flashcardSet of data.flashcardSets) {

            // initializing collection (a flashcard set) || to get rid of the "-" use this instead: /[\s\-]+/g
            const collectionName = flashcardSet.title;
            const collection = db.collection(collectionName);

            // insert the flashcards into the collection, checking if there are duplicates and avoiding them using upsert
            for (const flashcard of flashcardSet.flashcards) {
                await collection.updateOne(
                    {term: flashcard.term}, // finds by term
                    {$set: flashcard}, // update the document with new data
                    {upsert: true} // if exists: insert, else: update
                );
            }
            
            // inserting the metadata into one document inside the same collection to hold all the information about the set
            const metadata = {
                "metadata": true,
                "id": flashcardSet.id,
                "title": flashcardSet.title,
                "author": flashcardSet.author,
                "topic": flashcardSet.topic,
                "dateCreated": flashcardSet.dateCreated,
                "rating": flashcardSet.rating,
                "numberOfFlashcards": flashcardSet.numberOfFlashcards 
            };

            // inserting to collection
            await collection.updateOne(
                {id: flashcardSet.id},
                {$set: metadata}, // update the metadata document
                {upsert: true}
            );
            console.log(`Inserted data into collection: ${collectionName}`);

            // Upsert documents to avoid duplicates
        }
        console.log("Data upserted successfully into MongoDB Atlas!")
    } catch (err) {
        console.error('Error:', err);
    }
});



app.get('/api/get_collections', async (req, res) => {
    try {
        const db = client.db("flashcardSets");
        const collections = await db.listCollections().toArray();

        const results = [];
        for (const collection of collections) {
            const name = collection.name;
            const coll = db.collection(name);
            const docs = await coll.find({metadata:true}).toArray();
            results.push({collection: name, documents:docs});
        }

        res.status(200).json(results);

    } catch (e) {
        console.error("Error occured:", e);
        res.status(500).json({ message: 'An error occurred' });
    }
});

// get a specific flashcard set
app.get('/api/get_set/:collection', async (req, res) => {
    try {
        const db = client.db("flashcardSets");
        const collection = db.collection(req.params.collection);
        const set = {
            collection: collection.collectionName,
            ...await collection.findOne({metadata:true}),
            flashcards: await collection.find({ metadata: { $exists: false } }).toArray()
        };
        res.status(200).json(set);
    }
    catch (e) {
        console.error("Error occured:", e);
        res.status(500).json({ message: 'An error occurred' });
    } 
});

app.post('/api/upload_blog', async (req, res) => {
    try {
        const data = req.body;
        console.log(`Received data: ${JSON.stringify(data)}`);

        const db = client.db("blogs");
        const collection = db.collection("blogs");

        await collection.updateOne(
            { title: data.title },
            { $set: { ...data } },
            { upsert: true }
        )

        console.log(`Successfully inserted blog: ${data.title}`);
        res.json({ message: 'Blog uploaded successfully!' });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ message: 'An error occurred while uploading the blog' });
    }
});

app.get('/api/get_blogs', async (req, res) => {
    try {
        const db = await client.db("blogs");
        const collections = await db.collection("blogs");

        res.status(200).json(await (await collections.find({})).toArray());
        console.log("Successfully fetched blogs!"); 
    } 
    catch (e) {
        console.error("Error occured:", e);
        res.status(500).json({ message: 'An error occurred' });
    }
});

app.get("/api/get_blog/:document", async (req, res) => {
    try {
        const db = await client.db("blogs");
        const collection = await db.collection("blogs");

        console.log(decodeURIComponent(req.params.document));
        res.status(200).json(await collection.findOne({ title: decodeURIComponent(req.params.document) }));
        console.log(await collection.findOne({  }));
        console.log("Successfully fetched blog!");
    } catch (e) {
        console.error("Error occured:", e);
        res.status(500).json({ message: 'An error occurred' });
    }
});

app.post("/api/upload_user", async (req, res) => {
    try {
        const data = req.body;
        console.log(`Received data: ${JSON.stringify(data)}`);

        const db = client.db("users");
        const collection = db.collection("users");

        await collection.updateOne(
            { email: data.email },
            { $set: { ...data } },
            { upsert: true }
        );

        console.log(`Successfully inserted user: ${data.email}`);
        res.json({ message: 'User uploaded successfully!' });
    }
    catch (e) {
        console.error("Error occured:", e);
        res.status(500).json({ message: 'An error occurred while signing up user' });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const data = req.body;
        console.log(`Received data: ${JSON.stringify(data)}`);

        const db = client.db("users");
        const collection = db.collection("users");

        const user = await collection.findOne({ email: data.email, password: data.password });

        if (user) {
            console.log(`Successfully logged in user: ${ data.email }`);
            res.json({ firstName: user.firstName, lastName: user.lastName });
        } else {
            console.log(`Failed to log in user: ${data.email}`);
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (e) {
        console.error("Error occured:", e);
        res.status(500).json({ message: 'An error occurred while logging in user' });
    }
});

app.get('/', (req, res) => res.send('Hello from backend!'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
