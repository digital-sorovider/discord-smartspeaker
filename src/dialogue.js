require('dotenv').config()
const env = process.env
const config = require('../config.json')
const request = require('request')

const bot = config.bot

const URL = `https://www.chaplus.jp/v1/chat?apikey=${env.CHAPLUS_APIKEY}`

exports.dialogueResponse = async function (userRemark, username = null) {
  const request = {
    uri: URL,
    headers: {'Content-type': 'application/json'},
    body: JSON.stringify({
      utterance: userRemark,
      agentState:{
        agentName: bot.name,
        tone: bot.voice.tone,
        age: bot.voice.older
      }
    }),
  }

  if (username !== null) {
    request.body.username = username
  }

  const result = JSON.parse(await doPost(request))

  let choiceResponse
  
  if (result.responses.length > 0){
    const passResponses = result.responses.filter(response => response.score >= bot.voice.accuracy)
    
    if (passResponses.length > 0) {
      choiceResponse = passResponses[Math.floor(Math.random() * passResponses.length)]
    }
    else {
      choiceResponse = result.responses[Math.floor(Math.random() * result.responses.length)]
    }
  }
  else {
    console.log('no response')
    return false
  }

  const utterance = choiceResponse.utterance

  return utterance
}


function doPost(options) {
  return new Promise(function (resolve, reject) {
    request.post(options, function(err, req, data){
      if(!err) {
        resolve(data)
      }
      else {
        reject(err)
      }
    });
  });
}