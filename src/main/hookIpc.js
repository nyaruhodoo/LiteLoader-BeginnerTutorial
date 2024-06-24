const { eventDataType } = require('./type.js')
const { eventEmitter } = require('./events.js')

/**
 * 拦截主线程收到的消息(支持魔改参数)
 * @param {[{frameId:number,processId:number},boolean,string,[eventDataType,any]]} messageData 消息内容
 * @return {false|[{frameId:number,processId:number},boolean,string,[eventDataType,any]]} return false 可以中断函数
 */
const hookIpcMessage = (messageData) => {
  const [, , ipcName, [event, payload]] = messageData

  return messageData
}

/**
 * 拦截主线程发送的消息(支持魔改参数)
 * @param {[string,eventDataType|boolean,any]} sendData 消息内容
 * @return {false|[string,eventDataType|boolean,any]} return false 可以中断函数
 *
 */
const hookIpcSend = (sendData) => {
  const [ipcName, event, data] = sendData

  // 额外派发cmd事件，方便自己处理
  if (Array.isArray(data)) {
    eventEmitter.emit(data[0].cmdName, data[0].payload)
  }

  // 额外派发 response 事件，方便主线程模拟cmd事件时拿到返回值
  if (event.callbackId) {
    eventEmitter.emit(event.callbackId, data)
  }

  return sendData
}

module.exports = {
  hookIpc(window) {
    window.webContents.send = new Proxy(window.webContents.send, {
      apply(target, thisArg, args) {
        const ret = hookIpcSend(args)
        if (!ret) return
        return Reflect.apply(target, thisArg, ret)
      },
    })

    window.webContents._events['-ipc-message'] = new Proxy(
      window.webContents._events['-ipc-message'],
      {
        apply(target, thisArg, args) {
          const ret = hookIpcMessage(args)
          if (!ret) return
          return Reflect.apply(target, thisArg, ret)
        },
      },
    )
  },
}
