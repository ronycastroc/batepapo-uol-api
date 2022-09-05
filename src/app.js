import express from 'express';
import cors from 'cors';
import dayjs from 'dayjs';
import joi from 'joi';
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

let date;

setInterval(() => {
    date = dayjs().locale('pt-br').format(`HH:mm:ss`);
}, 1000);

/* Participants Routes */

const participantSchema = joi.object({
    name: joi.string().required().min(2).max(10)
});


app.post('/participants', async (req, res) => {
    const { name } = req.body;

    const validation = participantSchema.validate(req.body, { abortEarly: false });

    if(validation.error) {      
        const error = validation.error.details.map(value => value.message);  
        return res.status(422).send(error);
    }

    try {
        const listParticipants = await db.collection('participants').find().toArray();
        
        const isPartcipant = listParticipants.find(value => value.name === name);
        
        if(isPartcipant) {
            return res.sendStatus(409);     
        }           
        
        await db.collection('participants').insertOne({
            name, 
            lastStatus: Date.now()
        });
        await db.collection('messages').insertOne({
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: date
        });    
        res.sendStatus(201);
        
    } catch (error) {
        res.status(500).send(error.message);
    }

});

app.get('/participants', async (req, res) => {
    
    try {
        const listParticipants = await db.collection('participants').find().toArray();
        res.send(listParticipants);

    } catch (error) {
        res.status(500).send(error.message);
    } 
    
});


/* Messages Routes */

const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.valid('message', 'private_message')
});

app.post('/messages', async (req, res) => {
    const { user } = req.headers;
    const { to, text, type } = req.body;

    const validation = messageSchema.validate(req.body, { abortEarly: false });

    if (validation.error) {
        const error = validation.error.details.map(value => value.message);
        res.status(422).send(error);
    }

    try {
        const listUsers = await db.collection('participants').find().toArray();
        const isUser = listUsers.find(value => value.name === user);

        if(!isUser) {
           return res.sendStatus(422);
        }

        await db.collection('messages').insertOne({
            from: user,
            to,
            text,
            type,
            time: date
        })

        res.sendStatus(201);

    } catch (error) {
        res.status(500).send(error.message);
    }

});

app.get('/messages/', async (req, res) => {
    const limit = req.query.limit;
    const { user } = req.headers;

    try {
        const listMessages = await db.collection('messages').find().toArray();

        const messagesFilter = listMessages.filter(value => value.type === 'message' || value.type === 'status' || (value.type === 'private_message' && value.from === user) || (value.type === 'private_message' && value.to === user));

        if(!limit) {
            return res.send(messagesFilter);
        }

        res.send(messagesFilter.slice(-limit));        

    } catch (error) {
        res.status(500).send(error.message);
    } 

});

/* Status Routes */

app.post('/status', async (req,res) => {
    const { user } = req.headers;
    const statusUpdate = {
        name: user,
        lastStatus: Date.now()
    } 

    try {
        const userStatus = await db.collection('participants').find().toArray();

        const findUser = userStatus.find(value => value.name === user);

        if (!findUser) {
            return res.sendStatus(404);
        }

        await db.collection('participants').updateOne({ name: user }, { $set: statusUpdate } );

        res.sendStatus(200);

    } catch (error) {
        res.status(500).send(error.message);
    }
});

setInterval(async () => {
    const time = Date.now()
    const participants = await db.collection('participants').find().toArray();

    const participantsInactive = participants.filter(value => (time - value.lastStatus) > 10000);
    
    console.log(participantsInactive);
    
    if (participantsInactive.length > 0) {

        const messagesOut = participantsInactive.map(value => ({
            from: value.name,
            to: "Todos",
            text: "sai da sala...",
            type: "status",
            time: date
        })) 

        await db.collection('participants').deleteMany(participantsInactive.name);

        await db.collection('messages').insertMany(messagesOut);
    }
    
}, 15000);

app.listen(5000, () => console.log('Listen on 5000'));