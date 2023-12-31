import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"
import dotenv from "dotenv"
import joi from "joi"
import dayjs from "dayjs"

const app = express()
app.use(express.json())
app.use(cors())
dotenv.config()

// banco de dados
const mongoClient = new MongoClient(process.env.DATABASE_URL)
try{
    await mongoClient.connect()
    console.log("MongoDB conectado!")
} catch (err) {
    console.log(err.message)
}
const db = mongoClient.db()

// schemas
const schemaParticpants = joi.object({ name: joi.string().required() })
const schemaMessages = joi.object({
    from: joi.string().required(),
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().required().valid("message", "private_message")
})

// endpoints
app.post("/participants", async (req, res) => {
    const { name } = req.body

    const validation = schemaParticpants.validate(req.body, { abortEarly: false })
    if (validation.error) return res.sendStatus(422)

    try {
        const participant = await db.collection("participants").findOne({ name })
        if (participant) return res.sendStatus(409)

        await db.collection("participants").insertOne({ name, lastStatus: Date.now() })

        const message = {
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs(Date.now()).format("HH:mm:ss")
        }

        await db.collection("messages").insertOne(message)

        res.sendStatus(201)

    } catch (err) {
        return res.status(500).send(err.message)
    }
})

app.get("/participants", async (req, res) => {
    try {
        res.send(await db.collection("participants").find().toArray())
    } catch (err) {
        return res.status(500).send(err.message)
    }
})

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body
    const { user } = req.headers

    const validation = schemaMessages.validate({ ...req.body, from: user }, { abortEarly: false })
    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message)
        return res.status(422).send(errors)
    }

    try {
        const participant = await db.collection("participants").findOne({ name: user })
        if (!participant) return res.sendStatus(422)

        await db.collection("messages").insertOne(
            { 
                from: user, to, text, type, time: dayjs().format("HH:mm:ss") 
            })
        
        res.sendStatus(201)

    } catch (err) {
        return res.status(500).send(err.message)
    }
})

app.get("/messages", async (req, res) => {
    const { user } = req.headers
    const limit = parseInt(req.query.limit)

    //if (limit && (isNaN(limit) || limit < 0)) return res.sendStatus(422) 

    try {
        if ((limit !== undefined || limit !== null) && !isNaN(limit) && limit > 0) {
            res.send(await db.collection("messages")
            .find(
                { 
                    $or: [{ from: user }, { to: "Todos" }, { to: user }, { type: "message" }, { type: "private_message" }]
                })
            .limit(-limit)
            .toArray())
        } else {
            res.send(await db.collection("messages")
            .find(
                { 
                    $or: [{ from: user }, { to: "Todos" }, { to: user }, { type: "message" }, { type: "private_message" }]
                })
            .toArray())
        }

    } catch (err) {
        return res.status(500).send(err.message)
    }
})

app.post("/status", async (req, res) => {
    const { user } = req.headers

    if (!user) return res.sendStatus(404)

    try {
        const participant = await db.collection("participants").findOne({ name: user })
        if (!participant) return res.sendStatus(404)

        await db.collection("participants").updateOne({ name: user }, { $set: { lastStatus: Date.now() }}) 

        return res.sendStatus(200)

    } catch (err) {
        return res.status(500).send(err.message)
    }
})

setInterval( async () => {
    const tenSecondsAgo = Date.now() - 10000

    try {
        const inactiveParticipants = await db.collection("participants").deleteMany({ lastStatus: { $lt: tenSecondsAgo } })
        const removedCount = inactiveParticipants.deletedCount

        if (removedCount > 0) {
            const newMessage = {
                from: inactiveParticipants.name,
                to: 'Todos',
                text: 'sai da sala...',
                type: 'status',
                time: dayjs().format("HH:mm:ss")
            }

            await db.collection("messages").insertOne(newMessage)
        }

    } catch (err) {
        return res.status(500).send(err.message)
    }
}, 15000)

const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))