/* eslint-disable no-console */
require('dotenv').config();
const axios = require('axios');
const { MongoClient } = require('mongodb');

const arguments = process.argv.slice(2);

const client = new MongoClient(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const prefix = 'https://eu.api.blizzard.com';
let token = 'USmb9g78dBgqeLQhWGqmhm9uYmt1pbJ8P6';

function getUrl(path, namespace) {
  return `${prefix}${path}?namespace=${namespace}&access_token=${token}`;
}

async function getToken() {
  console.log('--------------------------\n[Authentication] : Getting Token');
  const response = await axios.post('https://eu.battle.net/oauth/token', {}, {
    auth: { username: '86becd6c5cfc4e18a72f36e8fedbaee1', password: 'WDm8GvXDcOm6Gzj2JXsFsCpuc4X0taNH' },
    params: { grant_type: 'client_credentials' },
  });
  token = response.data.access_token;
  await console.log(`[Authentication] : Finished. Token = ${token}`);
}

async function updatePlayerEquipment(character) {
  const equipment = [];
  const response = await axios.get(getUrl(`/profile/wow/character/${character.realm}/${character.name.toLowerCase()}/equipment`, 'profile-eu'));
  await response.data.equipped_items.forEach((entity) => {
    equipment[entity.slot.type] = entity.name.en_GB;
  });
  await client.db('statuswow').collection('players').updateOne({ id: character.id }, { $set: { equipment } }, { upsert: true });
}

async function queuePlayers() {
  console.log('--------------------------\n[PlayerUpdate] : Starting Update');
  const response = await axios.get(getUrl('/data/wow/pvp-season/29/pvp-leaderboard/3v3', 'dynamic-eu'));
  console.log(`[PlayerUpdate] : Found ${response.data.entries.length} players to update.`);

  const players = [];
  await response.data.entries.forEach(async (entity) => {
    players.push({
      id: entity.character.id,
      name: entity.character.name,
      realm: entity.character.realm.slug,
      faction: entity.faction.type,
    });
    return players;
  });

  const insertResponse = await client.db('statswow').collection('queue-players').insertMany(Array.from(players));

  await console.log(`[PlayerUpdate] : Number of players queued for update: ${insertResponse.insertedCount}`);
  await console.log('[PlayerUpdate] : Finished');
}

async function queue() {
  await client.connect(async (err) => {
    if (err) { process.exit(0); }
    console.log('Connected to Database');
    await getToken();
    await queuePlayers();
    await client.close();
  });
}

switch (arguments[0]) {
  case 'queue':
      queue();
      break;
  case 'update':
      update();
      break;
  default:
      console.log('Sorry, that is not something I know how to do.');
}
