const express = require("express")
const axios = require("axios")
const cors = require("cors")
const redis = require("redis");

let redisClient;

(async () => {
    redisClient = redis.createClient({ url: 'redis://127.0.0.1:6379' });

    redisClient.on("error", (error) => console.error(`Error : ${error}`));

    await redisClient.connect().then(() => {
        console.log("connected");
    });
})();


const DEFAULT_EXPIRATION = 3600

const app = express()

app.use(express.urlencoded({ extended: true }))
app.use(cors())

app.get("/photos", async (req, res) => {
    const albumId = req.query.albumId
    try {
        const photos = await getOrSetCache(`photos?albumId=${albumId}`, async () => {
            const { data } = await axios.get(
                "https://jsonplaceholder.typicode.com/photos",
                { params: { albumId } }
            )
            return data;
        })
        res.json(photos)
    }
    catch (err) {
        console.log(err);
        res.status(404).send("Data unavailable");
    }
})

function getOrSetCache(key, cb) {
    return new Promise(async (resolve, reject) => {
        let isCached = false
        console.log(key);
        const cachePhotosResults = await redisClient.GET(key, (err, reply)=>{
            if(err) return reject(err);
            console.log(reply);
            // console.log({data: data})
        })
        if (cachePhotosResults) {
            console.log("Cache Hit")
            isCached = true
            resolve(JSON.parse(cachePhotosResults))
        }
        const freshData = await cb()
        redisClient.SETEX(key, DEFAULT_EXPIRATION, JSON.stringify(freshData))
        resolve(freshData)
    })
}

app.listen(3000)