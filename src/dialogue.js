require('dotenv').config()
const env = process.env
const config = require('../config.json')
const request = require('request')
const tts = require('@google-cloud/text-to-speech');
const client = new tts.TextToSpeechClient();
const  { Readable } = require('stream');
require('discord-reply');

const bot = config.bot

const URL = `https://api-mebo.dev/api`

exports.dialogueResponse = async function (userRemark, username = null) {
  const request = {
    uri: URL,
    headers: {'Content-type': 'application/json'},
    body: JSON.stringify({
      utterance: userRemark,
      agent_id: env.AGENT_ID,
      api_key: env.CONVERSATION_AI_APIKEY,
      uid: username,
    }),
  }

  if (username !== null) {
    request.body.username = username
  }

  console.log('start reqest')
  const result = await doPost(request)
  console.log('got reqest')
  console.log(result)

  return result.bestResponse.utterance
}

exports.replyTTS = async function(replyText, connection) {

    const audioStream = new Readable({ read: () => {} });

    // 声の設定情報
    const request = {
      input: {text: replyText},
      voice: {
        languageCode: 'ja-JP',
        name: 'ja-JP-Wavenet-A'
      },
      audioConfig: {
        audioEncoding: 'OGG_OPUS',
        pitch: bot.voice.pitch,
        speakingRate: bot.voice.speakingRate
      },
    };

    const [response] = await client.synthesizeSpeech(request);

    const audioContent = response.audioContent;

    if (typeof audioContent === 'string') {
      const decoded = new Uint8Array(Buffer.from(audioContent, 'base64').buffer);
      return decoded;
    }

    audioStream.push(audioContent)
    const audioDispatcher = connection.play(audioStream);
    audioDispatcher.setVolume(bot.voice.volume)
}


exports.textTalkResponse = async function(userRemark, message) {
  const { channel } = message
  if (env.OBSERV_TEXT_CHANNEL !== channel.name) return
  const endpoint = 'https://api.a3rt.recruit-tech.co.jp/talk/v1/smalltalk'

  const request = {
    uri: endpoint,
    headers: {'Content-type': 'application/json'},
    form: {
      apikey: env.TALKAPI_KEY,
      query: userRemark
    },
  }

  const response = await doPost(request)

if(!response.results) return

  const [ result ] = response.results

  setTimeout(() => {
    channel.startTyping()
  }, 1000);

  setTimeout(() => {
    channel.stopTyping()
    message.lineReply(result.reply)
  }, 4000);


}

function doPost(options) {
  return new Promise(function (resolve, reject) {
    request.post(options, function(err, req, data){
      if(!err) {
        resolve(JSON.parse(data))
      }
      else {
        reject(err)
      }
    });
  });
}