import express from 'express';
import cors from 'cors';
import dayjs from 'dayjs';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect().then(() => {
    db = mongoClient.db('batepapouol');
});

const date = dayjs().locale('pt-br').format(`HH:mm:ss`);

app.post('/participants', async (req, res) => {
    const { name } = req.body;

    if(!name) {        
        return res.sendStatus(422);
    }

    try {
        const listParticipants = await db.collection('participants').find().toArray();
        
        for (let i = 0; i < listParticipants.length; i++) {
            if (name === listParticipants[i].name) {
                return res.sendStatus(409);                
            }
        }
        
        await db.collection('participants').insertOne({name, lastStatus: Date.now()});
        await db.collection('messages').insertOne({
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: date,
        });    
        res.sendStatus(201);
        
    } catch (error) {
        res.sendStatus(500);
    }

});


app.get('/participants', (req, res) => {
    db.collection('participants').find().toArray().then(data => {
        res.send(data);
    })
});

app.get('/messages', (req, res) => {
    db.collection('messages').find().toArray().then(data => {
        res.send(data);
    })
});



app.listen(5000, () => console.log('Listen on 5000'));