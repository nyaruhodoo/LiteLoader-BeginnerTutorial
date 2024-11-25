# LiteLoaderQQNT-BeginnerTutorial

~~随手写的还有人看，勉为其难的更新最后一次吧~~  
本文仅仅是把自己折腾的一些小东西整理了一下，倒也没有多少东西  
不出意外的话是不会再写更多内容了，因为我已经对插件开发失去了兴趣  
[自用插件开发模板](https://github.com/nyaruhodoo/LiteLoader-NapCatCore-Template)，如果我还有精力的话或许会把模板里挖的坑给填上

另外是本文不会给出太多代码，你可以结合上边的模板慢慢研究

# 从 LiteLoaderQQNT 的原理说起

这里只针对一些关键部分进行说明，你可以去[阅读源码](https://github.com/LiteLoaderQQNT/LiteLoaderQQNT/tree/main/src)了解更多细节(难度很低)

## 万恶之源

```ts
require('QQ/resources/app/LiteLoaderQQNT-main')
require('./launcher.node').load('external_index', module)
```

我想大家都知道 LiteLoader 如何安装，这里先无视掉完整性检查之类的东东  
显然易见的能看出来在 QQ 启动之前就执行了"我们"的代码，在 HOOK 这一领域，谁先执行谁有理  
在 JS 中我们不仅可以对全局 API 进行覆盖，import 的模块也可以通过 cache 进行覆盖  
通过这一操作就可以绝对掌握 QQ 的运行环境

讲一个小趣事，之前某个屏蔽百度的广告的JS插件用到了 `IntersectionObserver` 百度发现后直接把这个 API 赋值为 `null`  
因为油猴脚本的插入时机做不到比原逻辑更快

## 拦截 main

这里我们忽视掉所有细节直接看核心部分

```ts
require.cache['electron'] = new Proxy(require.cache['electron'], {
  get(target, property, receiver) {
    const electron = Reflect.get(target, property, receiver)
    return property != 'exports'
      ? electron
      : new Proxy(electron, {
          get(target, property, receiver) {
            const BrowserWindow = Reflect.get(target, property, receiver)
            return property != 'BrowserWindow'
              ? BrowserWindow
              : new Proxy(BrowserWindow, {
                  construct: proxyBrowserWindowConstruct,
                })
          },
        })
  },
})

function proxyBrowserWindowConstruct(target, [config], newTarget) {
  const window = Reflect.construct(
    target,
    [
      {
        ...config,
        webPreferences: {
          ...config.webPreferences,
          webSecurity: false,
          preload: processPreloadPath(config.webPreferences.preload),
        },
      },
    ],
    newTarget,
  )

  // 加载自定义协议
  protocolRegister(window.webContents.session.protocol)

  // 加载插件
  loader.onBrowserWindowCreated(window)

  return window
}
```

用了一种很奇妙的方式拦截了 qq 对 `electron` 依赖的访问，主要是替换了 `BrowserWindow` 函数，注入自己的 `preload` 文件，并将 `window` 传递给插件的 `onBrowserWindowCreated`

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

看到这里我想你已经对 LiteLoaderQQNT 有一个初步了解了，~~又或者对 JS 的 HOOK 有了个初步的了解~~  
它的代码十分精简，目的就是将插件的代码注入到 QQ 中

# 调试

~~[官方文档](https://liteloaderqqnt.github.io/docs/introduction.html#%E8%B0%83%E8%AF%95%E4%BB%A3%E7%A0%81) 我知道你们也懒得看~~

在 qq 安装文件夹下执行 `./qq.exe --enable-logging` 即可打开调试终端

![](https://files.catbox.moe/qygfyd.png)

调试渲染层可以安装这个插件[chii-devtools](https://github.com/mo-jinran/chii-devtools/tree/v4)，可以在 QQ 中使用 F12 打开开发者工具  
需要注意的是这是一个远程调试手段，他并不是真的 devTools，对于某些数据结构它无法很好的渲染
而且它无法对预渲染层进行调试，`preload.js` 和 chrome 扩展一样是在 `Isolated World` 里跑的，但 chii 没 hook `Isolated World` 里的 `console.log`  
~~也有其他魔法可以进行调试，但我觉得终端已经足够了~~

# 插件到底能做什么？

你已经获得了一个本地Node运行环境，并且可以去触碰QQ的部分主线程逻辑以及渲染层逻辑
简单来说，唯一限制你的是你的想象力

# 添加设置界面

我很纠结要不要把添加设置界面放在最开头，对我来说应该是先有设置界面再有核心功能，毕竟涉及到配置文件更新如果后期进行改动还是挺麻烦的  
这里提供一个思路来快速创建具备响应式的 UI 界面，如果对 UI 要求比较高可能不合适你  
下面用到的部分组件是 [LiteLoaderQQNT](https://liteloaderqqnt.github.io/docs/web-components.html) 提供的

[相关代码已进行迁移](https://github.com/nyaruhodoo/LiteLoader-Wrapper-Template/blob/master/src/renderer/configView/App.vue)


## 初始化与卸载逻辑

虽然我帮你解决了配置文件的更新问题，但你的插件如何去同步还是需要自己去做  
一个比较简单的办法是，你在代码中直接通过 `Utils.getConfig` 去访问最新的配置文件  
但如果你的逻辑涉及到 `CSS` 之类的可能就要面临先卸载再初始化一次了  
比如我自己的插件则是把所有事件 remove 后重新绑定

```ts
export const initGrabRedBag = async (config?: ConfigType) => {
  Utils.log('初始化成功', globalThis.authData)
  authData = globalThis.authData
  wrapperEmitter.removeAllListeners(EventEnum.onRecvMsg)
  ipcMain.removeAllListeners(`${slug}:update`)
  const newConfig = config ?? (await Utils.getConfig())

  wrapperEmitter.addListener(EventEnum.onRecvMsg, async ({ args }) => {})

  ipcMain.on(`${slug}:update`, (_, updateConfig: ConfigType) => {
    initGrabRedBag(updateConfig)
  })
}
```

# 在 IPC 做点什么

如果你对于 IPC 不太了解，可以先阅读 [electron 官方文档](https://www.electronjs.org/zh/docs/latest/tutorial/ipc)  
在这里我们简单的把 NTQQ 的 Vue 部分理解为前端，IPC 部分理解为后端  
只要 hook 了 IPC 部分，那么大部分功能其实也都可以实现了  
[相关代码已进行迁移](https://github.com/nyaruhodoo/LiteLoader-NapCatCore-Template/blob/master/src/main/hook/hookIPC.ts)，这里仅仅对 IPC 做一个比较简单的介绍

众所周知 IPC 是可以双向通信的，也就是主线程和渲染线程的通信，举个栗子

```ts
// 此处为渲染线程向主线程 emit 的消息
;[
  { frameId: 1, processId: 5 },
  false,
  // 这里的2，代表的是qq主窗口，每个窗口都具备自己的标识ID
  'IPC_UP_2',
  [
    {
      // request 代表请求主线程去做某件事
      type: 'request',
      // 该id用于主线程向渲染线程发送响应
      callbackId: '57ee753d-e390-46d0-b785-abff293786d4',
      // 该参数搭配下面的 checkHasMultipleQQ 会形成一个函数的调用
      eventName: 'ns-BusinessApi-2',
    },
    ['checkHasMultipleQQ'],
  ],
]
```

```ts
// 此处为主线程向渲染线程 send 的消息
;[
  'IPC_DOWN_2',
  {
    callbackId: '57ee753d-e390-46d0-b785-abff293786d4',
    promiseStatue: 'full',
    type: 'response',
    eventName: 'ns-BusinessApi-2',
  },
  // 只需关注这里即可，代表的是返回值
  true,
]
// 主线程除了会发送 response 也会发送 request 类型事件
;[
  ('IPC_DOWN_2',
  { type: 'request', eventName: 'ns-ntApi-2' },
  [
    {
      // 比如收到新消息时情况则会反过来，是主线程请求渲染线程去做某些事，会派发一个 cmd 事件
      cmdName: 'nodeIKernelGroupListener/onGroupNotifiesUnreadCountUpdated',
      cmdType: 'event',
      // 携带参数
      payload: [],
    },
  ]),
]
```

# 在 Wrapper 做点什么

这里的 Wrapper 指的是 QQ 中的 `wrapper.node`，你可以将它理解为 QQ 的底层依赖，其中提供了一套 API，当主线程收到 IPC 消息时会去调用 wrapper 中对应的函数  
你可能会好奇 IPC 与 Wrapper 有什么区别，让我举个小栗子你就知道了  
在 IPC 层监听新消息时需要去监听 `nodeIKernelMsgListener/onRecvActiveMsg` ，如果你已经这样做了或许会发现收到的消息并不完整时不时会丢掉很多消息，这是因为客户端做了一些限制只会获取已激活窗口下消息事件  
那么我们如果在 wrapper 中监听 `NodeIQQNTWrapperSession/create/getMsgService/addKernelMsgListener/onRecvMsg` 你就会发现一个消息都不会丢失  
简单来说 wrapper 中的 API 更加纯净，并且脱离客户端限制

[相关代码已进行迁移](https://github.com/nyaruhodoo/LiteLoader-NapCatCore-Template/blob/master/src/main/hook/hookWrapper.ts)

# 在渲染层做点什么

有空再写吧，因为我目前开发的插件完全不需要在渲染层做什么事情  
实际上到了这个步骤你直接拿到 window 对象，就把他当作一个浏览器去处理各种 DOM 即可

鸽啦~
