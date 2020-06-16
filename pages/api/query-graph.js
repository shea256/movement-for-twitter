import { Pool } from 'pg'
import { parse } from 'pg-connection-string' 
import Twit from 'twit'
import { queryGraph } from '../../lib/query-graph'

export default async (req, res) => {
  const { body: { dbString, twitterClient } } = req

  if (!twitterClient || !twitterClient.consumerKey || !twitterClient.consumerKey.length) {
    res.json({ followers: [] })
    return
  }

  const dbConfig = parse(dbString)
  const db = new Pool(dbConfig)

  const twitterAPIConfig = {
    consumer_key: twitterClient.consumerKey,
    consumer_secret: twitterClient.consumerSecret,
    access_token: twitterClient.accessToken,
    access_token_secret: twitterClient.accessTokenSecret,
    timeout_ms: 60*1000,
    strictSSL: true
  }
  const twitterAPI = new Twit(twitterAPIConfig)

  const followers = await queryGraph(db, 'followers', 100, 0, 'followers_count', 'DESC')

  const response = { "followers": followers }

  res.json(response)
}
