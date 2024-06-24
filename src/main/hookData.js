const {
  eventDataType,
  userDataType,
  sendMsgReqType,
  packRedBagReqType,
} = require('./type.js')

const hookSendData = {
  /**
   * 魔改本地SVIP相关标识
   * @param {[string,eventDataType,[{payload:userDataType}]]} sendData 消息内容
   * @return {false|[string,eventDataType,any]} return false 可以中断函数
   */
  'nodeIKernelProfileListener/onProfileDetailInfoChanged'(sendData) {
    const [ipcName, event, [cmdData]] = sendData
    cmdData.payload.info.vipFlag = true
    cmdData.payload.info.yearVipFlag = true
    cmdData.payload.info.svipFlag = true
    cmdData.payload.info.vipLevel = 5

    return sendData
  },
}

const hookMessageData = {
  /**
   * 拦截发送的消息
   * @param {[{frameId:number,processId:number},boolean,string,[eventDataType,[string,sendMsgReqType]]]} messageData 消息内容
   * @return {false|[{frameId:number,processId:number},boolean,string,[eventDataType,any]]} return false 可以中断函数
   */
  'nodeIKernelMsgService/sendMsg'(messageData) {
    const [, , ipcName, [event, [, payload]]] = messageData

    return messageData
  },

  /**
   * 拦截发的红包
   * @param {[{frameId:number,processId:number},boolean,string,[eventDataType,[string,packRedBagReqType]]]} messageData 消息内容
   * @return {false|[{frameId:number,processId:number},boolean,string,[eventDataType,any]]} return false 可以中断函数
   */
  'nodeIKernelMsgService/packRedBag'(messageData) {
    const [, , ipcName, [event, [, payload]]] = messageData

    return messageData
  },
}

module.exports = {
  hookSendData,
  hookMessageData,
}
