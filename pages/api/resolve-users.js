import { Pool } from 'pg'
import { parse } from 'pg-connection-string'
import { buildTwitterAPIFromConfig } from '../../lib/twitter-api'
import { sleep } from '../../lib/utils' 

function formatUsersFromTwitterResponse(data, tableName) {
  let newUsers = []

  data.map(user => {
    const followingMe = (tableName === 'followers') ? true : false
    const followedByMe = (tableName === 'followees') ? true : false

    newUsers.push({
      id: user.id,
      name: user.name,
      username: user.screen_name,
      location: user.location,
      description: user.description,
      url: user.url,
      followers_count: user.followers_count,
      followees_count: user.friends_count,
      listed_count: user.listed_count,
      created_at: user.created_at,
      favorites_count: user.favourites_count,
      verified: user.verified,
      statuses_count: user.statuses_count,
      language: user.lang,
      background_image: user.profile_background_image_url_https,
      profile_image: user.profile_image_url_https,
      banner_image: user.profile_banner_url,
      following_me: followingMe,
      followed_by_me: followedByMe
    })
  })

  return newUsers
}

function buildQueryStringForUserUpdate(id, fields, tableName) {
  const fieldNames = fields.map(field => field[0])
  let queryString = `UPDATE ${tableName} SET `
  let setStatements = []
  fieldNames.map((fieldName, i) => {
    setStatements.push(`${fieldName} = ($${i+1})`)
  })
  queryString += setStatements.join(', ')
  queryString += ` WHERE id = ${id}`
  return queryString
}

function getValuesFromUser(user, fields) {
  let values = []

  fields.map((field, index) => {
    const fieldName = field[0]
    const fieldType = field[1]

    let value = user[fieldName]

    if (!user.hasOwnProperty(fieldName) || value === undefined || value === null) {
      if (fieldType === 'text') {
        value = ''
      } else if (fieldType === 'boolean') {
        value = null
      } else if (fieldType === 'numeric') {
        value = 0
      } else {
        throw 'Invalid field type'
      }
    }

    values.push(value)
  })

  return values
}

const USER_TABLE_FIELDS = [
  ['name', 'text'],
  ['username', 'text'],
  ['location', 'text'],
  ['description', 'text'],
  ['url', 'text'],
  ['followers_count', 'numeric'],
  ['followees_count', 'numeric'],
  ['verified', 'boolean'],
  ['statuses_count', 'numeric'],
  ['language', 'text'],
  ['background_image', 'text'],
  ['profile_image', 'text'],
  ['banner_image', 'text'],
  ['following_me', 'boolean'],
  ['followed_by_me', 'boolean']
]

function resolveUsers(db, twitterAPI, tableName, limit, offset) {
  return new Promise((resolve, reject) => {
    //console.log('\n' + '='.repeat(50) + `\nTable: ${tableName}, Limit: ${limit}, Offset: ${offset}\n` + '='.repeat(50) + '\n')
    const queryStringForUserSelect =
      `SELECT id FROM ${tableName} ORDER BY id ASC LIMIT ${limit} OFFSET ${offset}`

    db.query(queryStringForUserSelect, (error, results) => {
      if (error) {
        console.error('DB Error:')
        console.error(error)
        reject(error)
        return
      }

      if (!('rows' in results)) {
        console.log('Results:')
        console.log(results)
      }

      const userListString = results['rows'].map(user => { return user.id }).join(',')
      const options = { user_id: userListString }
      twitterAPI.get('users/lookup', options, (error, data, response) => {
        if (error) {
          console.error('Twitter Error:')
          console.error(error)
          reject(error)
          return
        }

        const users = formatUsersFromTwitterResponse(data, tableName)

        users.map((user, index) => {
          const queryStringForUserUpdate = buildQueryStringForUserUpdate(
            user.id, USER_TABLE_FIELDS, tableName)

          const values = getValuesFromUser(user, USER_TABLE_FIELDS)
          //console.log(`${index} Updating user ${values[0]} (${values[1]})`)

          db.query(queryStringForUserUpdate, values, (error, results) => {
            if (error) {
              reject(error)
            }

            resolve(results)
          })
        })

      })

    })
  })
}

export default async (req, res) => {
  const { body: { db, twitterClient, group, limit, offset, count } } = req
  
  const dbPool = new Pool(parse(db.string))

  const twitterAPI = buildTwitterAPIFromConfig(twitterClient)

  let currentOffset = offset
  while (currentOffset < count) {
    console.log(`Starting to resolve users from ${currentOffset} to ${currentOffset + limit}`)
    try {
      const results = resolveUsers(dbPool, twitterAPI, group, limit, currentOffset)
      //console.log(results)
    } catch(e) {
      res.json({ error: e })
      return
    }
    currentOffset += limit
    console.log(`Resolved users from ${currentOffset} to ${currentOffset + limit}`)
    const sleepTime = 2000
    console.log(`Sleeping for ${sleepTime/1000} seconds`)
    await sleep(sleepTime)
  }
  
  res.json({ error: null, success: true })
}