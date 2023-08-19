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
    type: joi.string().required()
})

// endpoints
app.post("/participants", async (req, res) => {
    const { name } = req.body

    //console.log(name)

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

        res.status(201).send(message)

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

const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))