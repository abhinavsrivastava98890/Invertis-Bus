const express = require('express');
const { MongoClient } = require('mongodb');

const app = express();
app.use(express.json()); // Parses incoming JSON payloads

// Replace this with the Connection String from the "Drivers" menu in Atlas
const uri = "mongodb+srv://shivamg0705_db_user:<password>@gpstracker.7werti6.mongodb.net/?appName=GPSTracker";
const client = new MongoClient(uri);

app.post('/api/gps', async (req, res) => {
    try {
        const payload = req.body;
        // The server adds the exact time it received the ping
        payload.timestamp = new Date();

        await client.connect();
        // Automatically creates this database and collection if they don't exist
        const database = client.db("bus_management");
        const collection = database.collection("fleet_locations");

        const result = await collection.insertOne(payload);
        console.log("GPS data logged for vehicle:", result.insertedId);

        res.status(200).send("Logged to Atlas");
    } catch (error) {
        console.error(error);
        res.status(500).send("Database error");
    } finally {
        await client.close();
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Fleet tracking server running on port ${PORT}`));