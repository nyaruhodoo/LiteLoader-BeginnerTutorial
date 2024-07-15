# LiteLoaderQQNT-BeginnerTutorial

最近在写抢红包插件，因暂不开源所以就把一些折腾的小东西发出来。  
但愿能帮到同为初学者的你。  
~~其实也不是面向纯小白，我是假设你已经有一些 JS 基础的~~  
~~本来已经鸽了，看到一个 star，还是抽空更新下好了~~  
~~可以让我摆烂了吗，怎么越来越多~~

# 从 LiteLoaderQQNT 的原理说起

这里只针对一些关键部分进行说明，你可以去[阅读源码](https://github.com/LiteLoaderQQNT/LiteLoaderQQNT/tree/main/src)了解更多细节(难度很低)

## 拦截 main

```ts
require.cache['electron'] = new Proxy(require.cache['electron'], {
  get(target, property, receiver) {
    const electron = Reflect.get(target, property, receiver)
    if (property == 'exports') {
      return new Proxy(electron, {
        get(target, property, receiver) {
          const BrowserWindow = Reflect.get(target, property, receiver)
          if (property == 'BrowserWindow') {
            return new Proxy(BrowserWindow, {
              construct: proxyBrowserWindowConstruct,
            })
          }
          return BrowserWindow
        },
      })
    }
    return electron
  },
})
```

用了一种很奇妙的方式拦截了 qq 对 `electron` 依赖的访问，主要是替换了 `BrowserWindow` 函数，注入自己的 `preload` 文件，并将 `window` 传递给插件的 `onBrowserWindowCreated`  
因为插件的执行时机足够早，所以我们可以在 QQ 访问某些依赖之前就进行 hook

```ts
function proxyBrowserWindowConstruct(target, [config], newTarget) {
  const qqnt_preload_path = config.webPreferences.preload
  const window = Reflect.construct(
    target,
    [
      {
        ...config,
        webPreferences: {
          ...config.webPreferences,
          webSecurity: false,
          devTools: true,
          preload: processPreloadPath(qqnt_preload_path),
          additionalArguments: ['--fetch-schemes=local'],
        },
      },
    ],
    newTarget,
  )

  // 挂载窗口原preload
  window.webContents.preload = qqnt_preload_path

  //加载自定义协议
  protocolRegister(window.webContents.session.protocol)

  // 加载插件
  loader.onBrowserWindowCreated(window)

  return window
}
```

## 拦截 preload & renderer

实际上这里的只是拦截 main 的后续操作，毕竟加载的文件已经完全被替换  
唯一需要注意的是，preload 文件中并不支持原生的 require (polyfilled 实现)，这里采用了特殊的方式注入代码

```ts
// 通过自定义协议加载自己的 renderer，其中又加载了插件的 renderer
document.addEventListener('readystatechange', () => {
  if (document.readyState == 'interactive') {
    const script = document.createElement('script')
    script.type = 'module'
    script.src = `local://root/src/renderer.js`
    document.head.prepend(script)
  }
})

// 通过读取文件的方式加载其他 preload
const runPreloadScript = (code) =>
  binding.createPreloadScript(`
(async function(require, process, Buffer, global, setImmediate, clearImmediate, exports, module) {
    ${code}
});
`)(...arguments)
```

看到这里我想你已经对 LiteLoaderQQNT 有一个初步了解了，它的代码十分精简，目的就是将插件的代码注入到 QQ 中

# 目录结构

我使用的是[官方模板](https://github.com/LiteLoaderQQNT/Plugin-Template)，唯一不同的是我多创建了`main` `renderer`文件夹用来存放相关代码  
主要原因是主线程和渲染层使用的是完全不同的模块化方案，所以你会看到 2 个`utils`文件，其中会包含一些相同的代码  
~~我懒得上构建工具，你还会看到很多奇妙的方式去写类型，多少有点瞎眼~~

# 调试

~~[官方文档](https://liteloaderqqnt.github.io/docs/introduction.html#%E8%B0%83%E8%AF%95%E4%BB%A3%E7%A0%81) 我知道你们也懒得看~~

在 qq 安装文件夹下执行 `./qq.exe --enable-logging` 即可打开调试终端

![](https://files.catbox.moe/qygfyd.png)

调试渲染层可以安装这个插件[chii-devtools](https://github.com/mo-jinran/chii-devtools/tree/v4)，可以在 QQ 中使用 F12 打开开发者工具  
需要注意的是这是一个远程调试手段，他并不是真的 devTools，对于某些数据结构它无法很好的渲染
而且它无法对预渲染层进行调试，`preload.js` 和 chrome 扩展一样是在 `Isolated World` 里跑的，但 chii 没 hook `Isolated World` 里的 `console.log`  
~~也有其他魔法可以进行调试，但我觉得终端已经足够了~~

# 添加设置界面

我很纠结要不要把添加设置界面放在最开头，对我来说应该是先有设置界面再有核心功能，毕竟涉及到配置文件更新如果后期进行改动还是挺麻烦的  
这里提供一个思路来快速创建具备响应式的 UI 界面，如果对 UI 要求比较高可能不合适你  
下面用到的部分组件是 [LiteLoaderQQNT](https://liteloaderqqnt.github.io/docs/web-components.html) 提供的

**工具函数均可在本项目 src 目录下寻找，代码中不做过多解释**

```ts
// renderer.js

import { createConfigPage } from './renderer/createConfigPage.js'
export const onSettingWindowCreated = createConfigPage
```

```ts
// createConfigPage.js

/**
 * 用于创建插件相关的配置界面
 * @param {HTMLElement} view - LiteLoader自动生成的空白DOM元素
 */
export const createConfigPage = async (view) => {
  // CSS
  const linkEl = document.createElement('link')
  linkEl.rel = 'stylesheet'
  linkEl.href = `local:///${LiteLoader.plugins[NAME].path.plugin}/src/css/index.css`
  document.head.appendChild(linkEl)

  // DOM
  const configDom = await createResponsiveConfig()
  view.append(configDom)
}

const createResponsiveConfig = async () => {
  // BroadcastChannel 用于通知渲染层
  const bc = new BroadcastChannel(NAME)

  // 主线程初始化已经给了默认值，这里不再给了
  const _config = await LiteLoader.api.config.get(NAME)

  // 拦截 set 操作，同步给 LiteLoader
  const proxyConfig = createDeepProxy(_config, {
    set(target, prop, val) {
      target[prop] = val

      const copyObj = JSON.parse(JSON.stringify(_config))
      LiteLoader.api.config.set(NAME, copyObj)
      // 通知渲染层
      bc.postMessage(copyObj)
      // 通知主线程
      window[NAME].refresh(copyObj)
      return true
    },
  })

  const configList = createConfigList(proxyConfig)

  const configEl = configList.map((configItem) => {
    const settingEl = createSettingEl()
    const settingListEl = settingEl.querySelector('setting-list')

    for (const item of Array.isArray(configItem) ? configItem : [configItem]) {
      settingListEl.append(createConfigItem(item, proxyConfig))
    }
    return settingEl
  })

  let fragment = document.createDocumentFragment()
  fragment.append(...configEl)
  return fragment
}
```

也没什么复杂的，就是将配置对象包装成 Proxy 对象并且拦截赋值操作然后同步给 LiteLoader

```ts
// config.js

type Config = {
  // 标题
  title: string
  // 描述文本
  description?: string
  // 组件类型
  type: string
  // input 类型
  inputType?: string
  // 读取该值的路径
  keyPath: string
  // 绑定值
  value: any
  // 为了实现简单所有用户输入的内容均为原生input的value属性，你可以根据需要自行进行处理
  customStoreFormat?: (value: any) => any
}

export const createConfigList = (proxyConfig: (Config | Config[])[]) => {
  return [
    [
      {
        title: '不领取低于指定金额的红包',
        description: '金额是根据平均值计算(单位是分)',
        type: 'input',
        inputType: 'text',
        keyPath: 'minimumAmount',
        value: proxyConfig.minimumAmount,
        customStoreFormat(value) {
          return +value
        },
      },
    ],
    {
      title: '跳过发言领取口令红包',
      description: '怕别用！用别怕！',
      type: 'setting-switch',
      value: proxyConfig.skipPwd,
      keyPath: 'skipPwd',
    },
  ]
}
```

返回值应该很好理解，如果是同一个数组则会使用同一个`setting-list`组件  
~~其实应该加一个分类标题的，但是懒得再改~~  
![](https://files.catbox.moe/rjzzo5.png)

```ts
// createConfigItem.js

{
  const settingItemControlEl = document.createElement(item.type)
  configItemEl.append(settingItemControlEl)

  if (item.type === 'setting-switch') {
    if (item.value) {
      settingItemControlEl.setAttribute('is-active', true)
    }
    settingItemControlEl.addEventListener('click', function (e) {
      const isActive = settingItemControlEl.hasAttribute('is-active')
      settingItemControlEl.toggleAttribute('is-active')
      setProperty(proxyConfig, item.keyPath, !isActive)
    })
  }

  if (item.type === 'input') {
    settingItemControlEl.type = item.inputType
    settingItemControlEl.value = item.value

    settingItemControlEl.addEventListener('change', (e) => {
      const value = item.customStoreFormat
        ? item.customStoreFormat(e.target.value)
        : e.target.value

      setProperty(proxyConfig, item.keyPath, value)
    })
  }
}
```

目前支持的 type 类型有限，就连内置组件我也只写了`setting-switch`，不过对于大部分组件来说我想应该是够用了  
如果你想扩展也是很容易的，只需要在改动后调用`setProperty(proxyConfig, item.keyPath, value)`即可  
~~等 star 再多一些我考虑再补全？~~

## 初始化与卸载逻辑

```ts
// main.js

const { initGrabRedBag } = require('./main/grabRedBag')
initGrabRedBag()
```

```ts
// grabRedBag.js

/**
 * 初始化抢红包插件
 * @param {defaultConfig} config - 抢红包配置
 */
const init = async (config) => {
  config ||= await LiteLoader.api.config.get(NAME, defaultConfig)

  /**
   * 注册用户信息事件
   * @param {userDataType} payload - 用户数据
   */
  const onProfileDetailInfoChanged = (payload) => {
    _USER_DATA = payload.info
  }
  eventEmitter.on(
    'nodeIKernelProfileListener/onProfileDetailInfoChanged',
    onProfileDetailInfoChanged,
  )

  /**
   * 注册新消息事件
   * @param {object} payload - 新消息
   * @param {Array<msgItemType>} payload.msgList - 消息列表
   */
  const onRecvActiveMsg = async (payload) => {
    const { msgList } = payload

    for (const msg of msgList) {
      const { msgType } = msg

      try {
        if (msgType === 10) await onRecvActiveLuckyMoneyMsg(msg, config)
      } catch (error) {
        log(error)
      }
    }
  }
  eventEmitter.on('nodeIKernelMsgListener/onRecvActiveMsg', onRecvActiveMsg)

  log('初始化成功')
}

/**
 * 重新初始化抢红包插件
 * @param {defaultConfig} config - 抢红包配置
 */
const refresh = (config) => {
  log('配置文件已更新')
  log(JSON.stringify(config))
  eventEmitter.removeAllListeners(
    'nodeIKernelProfileListener/onProfileDetailInfoChanged',
  )
  eventEmitter.removeAllListeners('nodeIKernelMsgListener/onRecvActiveMsg')
  init(config)
}

module.exports = {
  initGrabRedBag() {
    init()
    ipcMain.on(NAME, (event, config) => {
      refresh(config)
    })
  },
}
```

```ts
// preload.js

const { contextBridge, ipcRenderer } = require('electron')

const NAME = 'GrabRedBag'

// 暴露给渲染层去触发 refresh
contextBridge.exposeInMainWorld(NAME, {
  refresh(config) {
    ipcRenderer.send(NAME, config)
  },
})
```

在插件被挂载的时候调用 `init` 方法，并且通过 `IPC` 监听更新事件触发 `refresh`  
具体的挂载卸载逻辑由你自己决定，这里只是展示部分代码可供参考，实际上你的初始化不一定在主线程，也可能在渲染层

# 在 IPC 做点什么

如果你对于 IPC 不太了解，可以先阅读 [electron 官方文档](https://www.electronjs.org/zh/docs/latest/tutorial/ipc)  
在这里我们简单的把 NTQQ 的 Vue 部分理解为前端，IPC 部分理解为后端  
只要 hook 了 IPC 部分，那么大部分功能其实也都可以实现了

```ts
// main.js

const { hookIpc } = require('./main/hookIpc')

exports.onBrowserWindowCreated = (window) => {
  hookIpc(window)
}
```

```ts
// hookIpc.js

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
```

其实说 hook ipc 也不是一个非常复杂的事情，我们只是监听它的收发操作(它是一个 EventEmitter)  
原理就是覆盖 `send` 方法和 `-ipc-message` 内部事件  
需要注意的是 hook ipc 只是过程而不是结果，我们的最终目的是了解 QQ 自己通过 IPC 做了哪些事，使用了什么数据结构，发生了什么事件  
当你摸清楚这一切后，你就可以使用 IPC 来手动触发这些事件

- 比如你想做防撤回，可以直接把撤回事件给中断，禁止它到渲染层
- 又或者抢红包，只需要拿到红包消息然后再触发抢红包事件即可

```ts
/**
 * 调用 QQ 底层函数
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
      [cmdName, ...args],
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
    undefined,
  )
}
```

这里列举了一个很简单的例子，便于你了解如何通过 ipc 调用底层函数  
需要注意的是 `IPC_UP_2` 和 `ns-ntApi-2` 这里有一个奇怪的数字 2 ，代表的是 QQ 的主窗口  
~~绝大多数逻辑其实都与 2 有关，所以我压根懒得传递这个参数~~

上面的代码我有意的省略了魔改参数的部分，如果你需要可以参考 `hookData.js`  
你只需要以同步的方式 return 魔改后的参数即可

```ts
const hookIpcSend = (sendData) => {
  const [ipcName, event, data] = sendData

  if (Array.isArray(data) && hookSendData[data[0].cmdName]) {
    return hookSendData[data[0].cmdName](sendData)
  }

  return sendData
}
```

# 在 Wrapper 做点什么

这里的 Wrapper 指的是 QQ 中的 `wrapper.node`，你可以将它理解为 QQ 的底层依赖，其中提供了一套 API  
使用 IPC 间接实现的功能其实都是基于 wrapper 的一层封装

```ts
// hookWrapper.js

Process.dlopen = new Proxy(Process.dlopen, {
  /**
   * @param {()=>void} target
   * @param {*} thisArg
   * @param {[{id:number,loaded:boolean,exports:{},paths:[],children:[]},string]} argArray - [module,filename]
   */
  apply(target, thisArg, argArray) {
    const ret = Reflect.apply(target, thisArg, argArray)
    const [{ exports }, fileName] = argArray

    if (fileName.includes('wrapper.node')) {
      argArray[0].exports = new Proxy(exports, {
        get(target, p, receiver) {
          if (typeof target[p] === 'function') {
            return new Proxy(target[p], {
              construct(target, argArray) {
                const ret = Reflect.construct(target, argArray)

                return ret
              },
            })
          }
          return Reflect.get(target, p, receiver)
        },
      })
    }

    return ret
  },
})
```

这也是我偷学的，之前我一直不知道怎么才能 hook 到 `.node` 这种二进制文件，没想到还有一个神奇的函数 `Process.dlopen`  
如果你对这部分比较感兴趣可以去了解另一个项目 [NapCatCore](https://github.com/NapNeko/LiteLoader-NapCatCore) ~~没想到吧，我也是 Contributor~~ ，又或者是 [NapCatQQ](https://github.com/NapNeko/NapCatQQ)  
这里只提供一个爬梯让你知道怎么去触碰它  
不过需要提前给你打个预防针，Wrapper 中拿到的数据和从 IPC 拿到的数据并没有什么不同，所以不要有太大期待  
~~(比如我就想尝试用它抢手机端的红包，结果嘛...)~~  
~~(如果你有本事去逆向它，那我只能说 xmsl，tql)~~

# 在渲染层做点什么

有空再写吧，因为我目前开发的插件完全不需要在渲染层做什么事情  
实际上到了这个步骤你直接拿到 window 对象，就把他当作一个浏览器去处理各种 DOM 即可
