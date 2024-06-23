# LiteLoaderQQNT-BeginnerTutorial

最近在写抢红包插件，因暂不开源所以就把一些折腾的小东西发出来。  
但愿能帮到同为初学者的你。  
~~本来已经鸽了，看到一个 star，还是抽空更新下好了~~

# 从 LiteLoaderQQNT 的原理说起

这里只针对一些关键部分进行说明，你可以去阅读源码了解更多细节(难度很低)

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

# 添加设置界面

我很纠结要不要把添加设置界面放在最开头，对我来说应该是先有设置界面再有核心功能，毕竟涉及到配置文件更新如果后期进行改动还是挺麻烦的  
这里提供一个思路来快速创建具备响应式的 UI 界面，如果对 UI 要求比较高可能不合适你  
下面用到的部分组件是 `LiteLoaderQQNT` 提供的

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
  linkEl.href = `local:///${LiteLoader.plugins.QQRedPackGetterII.path.plugin}/src/css/index.css`
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

```ts
// config.js

export const createConfigList = (proxyConfig) => {
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
  ]
}
```

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
