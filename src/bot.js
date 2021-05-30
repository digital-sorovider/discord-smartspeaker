const config = require('../config.json')
require('dotenv').config()
const env = process.env
const Discord = require('discord.js');
const speech = require('@google-cloud/speech');
const speechClient = new speech.SpeechClient()


const client = new Discord.Client();

client.once('ready', async () => {
  const allCh = client.channels.cache.array()
  
  const voiceCh = allCh.find(channel => channel.name === config.channel.voice)
  const textCh = allCh.find(channel => channel.name === config.channel.text)

  const voiceConn = await voiceCh.join()
  console.log('join')

  // const musicDispatcher = voiceConn.play('sample.mp3')
  // musicDispatcher.setVolume(40 / 1000)

  voiceConn.once('speaking', async (user, speaking) => {
    const receiver = voiceConn.receiver

    if(!speaking) return

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
      .on('data', data => {
        const result = data.results[0].alternatives[0].transcript
        // textCh.send(result)
        console.log(result);
      });

    audioStream.pipe(recognizeStream)

  })

});

client.login(env.BOT_TOKEN);
