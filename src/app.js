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

const date = dayjs().locale('pt-br').format(`HH:mm:ss`);

const participantsSchema = joi.object({
    name: joi.string().required().min(2).max(10)
});

app.post('/participants', async (req, res) => {
    const { name } = req.body;

    const validation = participantsSchema.validate(req.body, { abortEarly: false });

    if(validation.error) {      
        const error = validation.error.details.map(value => value.message);  
        return res.status(422).send(error);
    }

    try {
        const listParticipants = await db.collection('participants').find().toArray();
        
        const isPartcipants = listParticipants.find(value => value.name === name);
        
        if(isPartcipants) {
            return res.sendStatus(409);     
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
        res.status(500).send(error);
    }

});

app.get('/participants', async (req, res) => {
    
    try {
        const listParticipants = await db.collection('participants').find().toArray();
        res.send(listParticipants);

    } catch (error) {
        res.status(500).send(error);
    } 
    
});

const messagesSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.valid('message', 'private_message')
})

app.post('/messages', async (req, res) => {
    const { user } = req.headers;
    const { to, text, type } = req.body;

    const validation = messagesSchema.validate(req.body, { abortEarly: false });

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
        res.status(500).send(error);
    }

})

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
        res.status(500).send(error);
    } 

});



app.listen(5000, () => console.log('Listen on 5000'));