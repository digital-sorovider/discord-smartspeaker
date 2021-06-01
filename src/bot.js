const config = require('../config.json')
require('dotenv').config()
const env = process.env
const Discord = require('discord.js');
const speech = require('@google-cloud/speech');
const speechClient = new speech.SpeechClient()
const client = new Discord.Client();

const command = config.bot.command

let lastTalk
let volume = 80
const volumeRate = 1000
let musicDispatcher

client.on('ready', async () => {
  console.log('ready')
  const allCh = client.channels.cache.array()
  
  const voiceCh = allCh.find(channel => channel.name === config.channel.voice)
  const textCh = allCh.find(channel => channel.name === config.channel.text)

  const voiceConn = await voiceCh.join()
  console.log('join')

  dummyGreeting(voiceConn)

  voiceConn.on('speaking', async (user, speaking) => {
    if(!speaking) return
    console.log('speaking default')
    voiceCommandListener(user, speaking, voiceConn)
  })

});

client.on('message', async (message) => {
  const content = message.content

  if(!content.match('!n')) return
  switch (true) {
    case /come/.test(content):
      const voiceConn = await message.member.voice.channel.join()
      dummyGreeting(voiceConn)
      voiceConn.on('speaking', async (user, speaking) => {
        console.log('speaking come')
        voiceCommandListener(user, speaking, voiceConn)
      })
      break;

    case /bye/.test(content):
      message.guild.me.voice.channel.leave()
      break;
  
    default:
      break;
  }
})

client.login(env.BOT_TOKEN);

function voiceCommandListener(user, speaking, voiceConn) {
  const receiver = voiceConn.receiver
  const audioStream = receiver.createStream(user, { mode: 'pcm' });

  const sampleRateHertz = 48000
  const request = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: sampleRateHertz,
      languageCode: 'ja-jp',
    },
    interimResults: false,
  };

  const recognizeStream = speechClient
    .streamingRecognize(request)
    .on('error', console.error)
    .on('data', async data => {
      let result = data.results[0].alternatives[0].transcript

      regexp = new RegExp('^' + command.prefix + '(.+$)')
      const prefixExists = result.match(regexp)
      console.log(prefixExists)
      if (lastTalk === command.prefix || prefixExists) {

        if (prefixExists) {
          result = result.replace(regexp, "$1")
        }
        console.log('command start')

        switch (result) {
          case command.sampleMusic:
            const replyDispatcher = voiceConn.play('resource/reply.mp3')
            replyDispatcher.setVolume(200 / volumeRate)
  
            replyDispatcher.on('finish', () => {
              console.log('sample music start')
              setTimeout(() => {
                musicDispatcher = voiceConn.play('resource/sample-music.mp3')
                musicDispatcher.setVolume(volume / volumeRate)  
              }, 1500);
            })
            break;

          case command.volumeUp:
            if (!musicDispatcher) return
            console.log('volume up')
            volume += 20
            musicDispatcher.setVolume(volume / volumeRate)  
            break;

          case command.volumeDown:
            if (!musicDispatcher) return
            console.log('volume down')
            volume -= 20
            if (volume < 0) {
              volume = 0
            }
            musicDispatcher.setVolume(volume / volumeRate)  
            break;

          case command.bye:
            voiceConn.disconnect()
            break;
        
          default:
            break;
        }

      }

      lastTalk = result
      // textCh.send(result)
      console.log(result);
    });

  audioStream.pipe(recognizeStream)
}

function dummyGreeting(connection) {
  const greetingDispatcher = connection.play('resource/reply.mp3')
  greetingDispatcher.setVolume(0)
}
