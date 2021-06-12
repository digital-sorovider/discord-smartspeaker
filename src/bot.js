const config = require('../config.json')
require('dotenv').config()
const env = process.env
const Discord = require('discord.js');
const speech = require('@google-cloud/speech');
const speechClient = new speech.SpeechClient()
const client = new Discord.Client();
const { dialogueResponse, replyTTS } = require('./dialogue')

const command = config.bot.command

const lastTalk = {} // ユーザーが最後に発言した内容を保持する
let volume = 0.3 // デフォルトボリューム
let musicDispatcher // 音声再生オブジェクト
let dialogueMode = false

// BOT起動完了
client.on('ready', async () => {
  console.log('ready')
  const allCh = client.channels.cache.array() // サーバーの全チャンネル

  const voiceCh = allCh.find(channel => channel.name === config.channel.voice)　// デフォルト設定のボイスチャンネル
  const textCh = allCh.find(channel => channel.name === config.channel.text) //　デフォルト設定のテキストチャンネル

  // デフォルト設定のボイスチャンネル入室
  const voiceConn = await voiceCh.join()
  console.log('join')

  dummyGreeting(voiceConn)  // ダミー音声再生

  // ユーザーのボイス受信
  voiceConn.on('speaking', async (user, speaking) => {
    if (!speaking) return
    console.log('speaking default')
    voiceCommandListener(user, speaking, voiceConn, textCh) // ボイスコマンド判定・実行
  })

});

// チャットメッセージ受信
client.on('message', async (message) => {
  const content = message.content

  if (!content.match('!n')) return
  switch (true) {

    // comeコマンドを使用したユーザーのボイスチャンネルへ移動
    case /come/.test(content):
      const existConn = message.guild.me.voice.connection
      if (existConn) {
        existConn.removeAllListeners()
      }

      const voiceConn = await message.member.voice.channel.join()
      dummyGreeting(voiceConn)
      voiceConn.on('speaking', async (user, speaking) => {
        console.log('speaking come')
        voiceCommandListener(user, speaking, voiceConn)
      })
      break;

    // ボイスチャンネルから退出
    case /bye/.test(content):
      message.guild.me.voice.channel.leave()
      break;

    // 指定テキストチャンネルへチャット送信
    case /say/.test(content):
      const [ , , channelName, ...texts ] = content.split(' ')
      const text = texts.join(' ')
      
      const allCh = message.guild.channels.cache.array()
      const textCh = allCh.find(channel => channel.name === channelName)
      textCh.send(text)
      break;

    default:
      const response = await dialogue.dialogueResponse(content, message.member.nickname)
      message.channel.send(response)
      break;
  }
})
client.login(env.BOT_TOKEN);

// ボイスコマンド受信
function voiceCommandListener(user, speaking, voiceConn, textChannel = false) {
  const [guild] = user.client.guilds.cache.array() // ユーザーが参加しているギルド
  const member = guild.member(user) // 発言したユーザーの情報

  const receiver = voiceConn.receiver
  const audioStream = receiver.createStream(user, { mode: 'pcm' }); // ユーザーの音声データ取得

  const sampleRateHertz = 48000 // 音声データのサンプルレート

  // Google Speech API へのリクエストするための音声形式の指定
  const request = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: sampleRateHertz,
      languageCode: 'ja-jp',
    },
    interimResults: false,
  };

  // 音声認識内容の処理
  const recognizeStream = speechClient
    .streamingRecognize(request)
    .on('error', console.error)
    .on('data', async data => {

      let result = data.results[0].alternatives[0].transcript // ユーザーの発言した文字列

      regexp = new RegExp('^' + command.prefix + '(.+$)')
      const prefixExists = result.match(regexp)
      if ((lastTalk[user.id] && lastTalk[user.id] === command.prefix) || prefixExists) { // コマンドプレフィックスの有無判定

        if (prefixExists) {
          // ユーザーがコマンドとコマンドプレフィクスを同時に発言していた場合はコマンドプレフィックス部分の文字列を排除する
          result = result.replace(regexp, "$1")
        }
        console.log('command start')

        switch (result) {

          // サンプルミュルミュージック①再生
          case command.sampleMusic:
            playMusic(voiceConn, 'resource/sample-music.mp3')
            break;

          // サンプルミュージック②再生
          case command.darkSlayer:
            playMusic(voiceConn, 'resource/darkslayer.mp3')
            break;

          // 音量を上げる
          case command.volumeUp:
            if (!musicDispatcher) return
            console.log('volume up')
            musicDispatcher.setVolume(volume += 0.2)
            break;

          // 音量を下げる
          case command.volumeDown:
            if (!musicDispatcher) return
            console.log('volume down')
            volume -= 0.2
            if (volume < 0) {
              volume = 0
            }
            musicDispatcher.setVolume(volume -= 0.2)
            break;

          // ボイスチャンネルから退室
          case command.bye:
            const byeDispatcher = voiceConn.play('resource/bye.mp3')
            byeDispatcher.setVolume(0.7)
            byeDispatcher.on('finish', () => {
              voiceConn.disconnect()
            })
            break;

          // 雑談モード開始
          case command.startDialogueMode:
            dialogueMode = true
            playGreeting(voiceConn)
            break;

          // 雑談モード停止
          case command.stopDialogueMode:
            dialogueMode = false
            playGreeting(voiceConn)
            break;

          default:
            conversation(result, voiceConn, textChannel, member)
            break;
        }

      }
      else if (dialogueMode) {
        conversation(result, voiceConn, textChannel, member)
      }

      // 発言の保持
      lastTalk[user.id] = result
      // textCh.send(result)
      console.log(result);
    });

  // 音声認識実行
  audioStream.pipe(recognizeStream)
}

// ボイスチャンネル参加時のダミー音声
function dummyGreeting(connection) {
  const greetingDispatcher = connection.play('resource/reply.mp3')
  greetingDispatcher.setVolume(0)
}

// 音楽ファイル再生
function playMusic(connection, filePath) {
  const replyDispatcher = playGreeting(connection)

  replyDispatcher.on('finish', () => {
    console.log('music start')
    setTimeout(() => {
      musicDispatcher = connection.play(filePath)
      musicDispatcher.setVolume(volume)
    }, 1500);
  })
}


function playGreeting(connection) {
  const replyDispatcher = connection.play('resource/reply.mp3')
  replyDispatcher.setVolume(0.8)

  return replyDispatcher
}

async function conversation(userRemark, voiceConnection, textChannel, member) {
  const response = await dialogueResponse(userRemark, member.nickname)
  // console.log(member.nickname, 'への返答: ' , response)
  replyTTS(response, voiceConnection)
  if (textChannel) {
    textChannel.send(response)
  }
}