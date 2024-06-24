const { ipcMain } = require('electron')
const { randomUUID } = require('crypto')
const { defaultConfig } = require('./defaultConfig.js')
const { eventEmitter } = require('./events.js')
const {
  grabRedBagReqType,
  grabRedBagResType,
  pullDetailRspType,
  resType,
} = require('./type.js')

const NAME = 'GrabRedBag'

/**
 * 用来判断事件名是否是无意义的(暂时不关注)
 * @param {string?} eventName
 * @param {string?} cmdName
 */
const isSkip = (eventName, cmdName) => {
  // 已知的无意义事件
  const filterEventNames = ['BusinessApi', 'LoggerApi', 'WindowApi']
  const filterCmdNames = []

  const a = filterEventNames.some((name) => {
    return eventName?.includes(name)
  })
  const b = filterCmdNames.some((name) => {
    return cmdName?.includes(name)
  })

  return a || b
}

/**
 * 过滤无关事件输出内容
 * @param {object} logData
 * @param {any} logData.data - 输出内容
 * @param {string} logData.eventName - 事件名
 * @param {string} logData.cmdName - cmd事件名
 * @param {string} logData.title - 提示文本
 * @param {boolean} logData.isJson - 是否转换json
 */
const filterLog = ({ data, eventName, cmdName, title, isJson }) => {
  if (isSkip(eventName, cmdName)) return
  console.log(`---------------${title}---------------`)
  console.log(isJson ? JSON.stringify(data) : data)
}

/**
 * 带有插件标识的log
 * @param  {...any} args
 */
const log = (...args) => {
  console.log(`[${NAME}]:`, ...args)
}

/**
 * 生成随机整数
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 */
const randomInteger = (min, max) => {
  let rand = min + Math.random() * (max + 1 - min)
  return Math.floor(rand)
}

/**
 * 返回一个指定时间后决议为 resolve 的 promise
 * @param {number} millisecond 毫秒
 */
const wait = (millisecond) => {
  if (millisecond <= 0) return
  return new Promise((resolve) => {
    setTimeout(resolve, millisecond)
  })
}

/**
 * 检查红包是否为黑名单
 * @param {defaultConfig} config - 红包配置
 * @param {object} msg - 红包数据
 * @param {string} msg.peerUin - 发红包的群
 * @param {string} msg.senderUin - 发红包的人
 * @param {string} msg.title - 红包标题
 */
const checkBlacklist = (config, msg) => {
  const { senderBlacklist, groupBlacklist, redPackTextBlacklist } = config
  const { peerUin, senderUin, title } = msg

  return (
    senderBlacklist.includes(senderUin) ||
    groupBlacklist.includes(peerUin) ||
    redPackTextBlacklist.includes(title)
  )
}

/**
 * 调用 QQ 底层函数 (在主线程模拟渲染层调用)
 * @param { string } eventName 函数事件类型。
 * @param { string } cmdName 函数名。
 * @param  { ...any } args 函数参数。
 * @return {Promise<any>}
 */
const invokeNative = (eventName, cmdName, ...args) => {
  const callbackId = randomUUID()

  return new Promise((resolve) => {
    ipcMain.emit(
      'IPC_UP_2',
      // 实际上这个event对象的模拟完全没作用，qq 的底层逻辑不会用到它
      {
        sender: {
          send(...args) {
            log('拦截了send', ...args)
          },
        },
        reply(...args) {
          log('拦截了reply', ...args)
        },
      },
      { type: 'request', callbackId, eventName },
      [cmdName, ...args]
    )

    eventEmitter.once(callbackId, resolve)
  })
}

/**
 * 精简版发送消息，只支持纯文本
 * @param {object} data - 参数
 * @param {string} data.content - 发送内容
 * @param {number} data.chatType - 消息类型(1私人，2群组)
 * @param {string} data.peerUid - 接收人Uid / 群号
 * @return {resType}
 */
const sendMsgInvokeNative = (data) => {
  // 确保所有值都是存在的，防止后期有改动导致封号
  if (!Object.values(data).every(Boolean))
    throw new Error('参数有错，请检查QQ是否有更新')

  return invokeNative(
    'ns-ntApi-2',
    'nodeIKernelMsgService/sendMsg',
    {
      msgId: '0',
      msgAttributeInfos: new Map(),
      peer: {
        chatType: data.chatType,
        guildId: '',
        peerUid: data.peerUid,
      },
      msgElements: [
        {
          elementType: 1,
          elementId: '',
          textElement: {
            content: data.content,
            atType: 0,
            atUid: '',
            atTinyId: '',
            atNtUid: '',
          },
        },
      ],
    },
    undefined
  )
}

/**
 * 抢红包 (本身不区分红包类型)
 * @param {grabRedBagReqType} grabRedBagReq - 红包参数
 * @return {grabRedBagResType}
 */
const grabRedBagInvokeNative = (grabRedBagReq) => {
  // 确保所有值都是存在的，防止后期有改动导致封号
  if (!Object.values(grabRedBagReq).every(Boolean))
    throw new Error('参数有错，请检查QQ是否有更新')

  // 普通红包
  return invokeNative(
    'ns-ntApi-2',
    'nodeIKernelMsgService/grabRedBag',
    {
      grabRedBagReq,
    },

    // QQ 写死的参数，不做修改
    { timeout: 5000 }
  )
}

/**
 * 获取红包金额
 * @param {sting} pcBody - 红包参数
 * @param {sting} recvUin - 个人uin
 * @param {number} recvType - chatType
 * @return {pullDetailRspType}
 */
const getLuckyMoneyDetailInvokeNative = (pcBody, recvUin, recvType) => {
  return invokeNative(
    'ns-ntApi-2',
    'nodeIKernelMsgService/pullDetail',
    {
      pullDetailReq: {
        pcBody,
        offset: 0,
        limit: 20,
        recvUin,
        recvType,
      },
    },
    null
  )
}

module.exports = {
  log,
  filterLog,
  isSkip,
  checkBlacklist,
  wait,
  randomInteger,
  invokeNative,
  sendMsgInvokeNative,
  grabRedBagInvokeNative,
  getLuckyMoneyDetailInvokeNative,
  NAME,
}
