# LiteLoaderQQNT-BeginnerTutorial

最近在写抢红包插件，因暂不开源所以就把一些折腾的小东西发出来。  
但愿能帮到同为初学者的你。

## 如何添加插件设置界面

看了很多项目，相当一部分是不选择添加设置界面的，希望这里的小工具能帮到大家  
如果你对界面要求较高可能不合适，该工具只能快速创建 `input` `switch`，对于大部分插件我想是足够了  
~~不要问为什么默认没有 `select` 因为我自己还没用到~~

```js
// 一些辅助函数
/**
 * 修改对象指定路径属性
 * @param {object} obj
 * @param {string} path
 * @param {*} value
 */
export const setProperty = (obj, path, value) => {
  const keys = path.split('.')
  const lastKey = keys.pop()
  const parent = keys.reduce((acc, key) => acc[key] || (acc[key] = {}), obj)
  parent[lastKey] = value
}

/**
 * 为对象创建深层Proxy
 * @param {object} obj
 * @param {object} handler
 */
export const createDeepProxy = (obj, handler) => {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  for (let key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      obj[key] = createDeepProxy(obj[key], handler)
    }
  }

  return new Proxy(obj, handler)
}

/**
 * 读取指定view html模板转换为DOM结构
 * @param {String} url
 */
export const viewText2Html = async (url) => {
  const text = await (await fetch(url)).text()
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'text/html')
  let fragment = document.createDocumentFragment()
  fragment.append(...doc.body.children)
  return fragment
}
```

```js
import { setProperty, createDeepProxy } from './utils.js'

/**
 * 用于创建插件相关的配置界面
 * @param {HTMLElement} view
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
  const bc = new BroadcastChannel('QQRedPackGetterII')
  const _config = await LiteLoader.api.config.get('QQRedPackGetterII')
  const proxyConfig = createDeepProxy(_config, {
    get(...params) {
      return Reflect.get(...params)
    },
    set(target, prop, val) {
      target[prop] = val
      LiteLoader.api.config.set('QQRedPackGetterII', proxyConfig)
      bc.postMessage(proxyConfig)
      return true
    },
  })

  // 可以配置为一个二维数组，同一个数组的配置项属于同一个 setting-list
  const configList = [
    {
      title: '黑名单关键字',
      description: '会跳过包含关键字的红包，使用&进行分割',
      type: 'input',
      inputType: 'text',
      value: proxyConfig.redPackTextBlacklist.join('&'),
      // 如果你不希望 input 绑定值存储为字符串，则可以提供一个自定义函数
      customStoreFormat(value) {
        return value.trim().split('&')
      },
    },
    [
      {
        title: '最小延迟',
        type: 'input',
        inputType: 'number',
        value: proxyConfig.randomDelay.min,
        keyPath: 'randomDelay.min',
        customStoreFormat(value) {
          return +value
        },
      },

      {
        title: '最大延迟',
        type: 'input',
        inputType: 'number',
        value: proxyConfig.randomDelay.max,
        keyPath: 'randomDelay.max',
        customStoreFormat(value) {
          return +value
        },
      },
    ],
    {
      title: '领取口令红包',
      description: '实验性功能，采用模拟点击实现的，不保证稳定性',
      type: 'setting-switch',
      value: proxyConfig.pwdRedPack,
      keyPath: 'pwdRedPack',
    },
    {
      title: '监听消息列表',
      description: '实验性功能，采用模拟点击实现的，不保证稳定性',
      type: 'setting-switch',
      value: proxyConfig.isMessageListListening,
      keyPath: 'isMessageListListening',
    },
  ]

  const configEl = configList.map((configItem) => {
    const settingEl = createSettingEl()
    const settingListEl = settingEl.querySelector('setting-list')

    for (const item of Array.isArray(configItem) ? configItem : [configItem]) {
      settingListEl.append(createSettingItemEl(item, proxyConfig))
    }
    return settingEl
  })

  let fragment = document.createDocumentFragment()
  fragment.append(...configEl)
  return fragment
}

/**
 * 根据configItem创建settingItem，并添加数据关联
 * @param {object} item
 * @param {string} item.type
 * @param {string} item.inputType
 * @param {string} item.title
 * @param {string=} item.description
 * @param {string | boolean} item.value
 * @param {string} item.keyPath
 * @param {Function} item.customStoreFormat
 * @param {object} targetObject
 */
const createSettingItemEl = (item, targetObject) => {
  // 初始化配置项
  const settingItemEl = document.createElement('setting-item')
  settingItemEl.setAttribute('data-direction', 'row')
  settingItemEl.innerHTML = '<div class="setting-item-text"></div>'

  // 创建标题
  {
    const textBoxEl = settingItemEl.querySelector('.setting-item-text')
    const titleEl = document.createElement('setting-text')

    titleEl.innerHTML = item.title
    textBoxEl.append(titleEl)

    if (item.description) {
      const descriptionEl = document.createElement('setting-text')
      descriptionEl.setAttribute('data-type', 'secondary')
      descriptionEl.innerHTML = item.description
      textBoxEl.append(descriptionEl)
    }
  }

  // 创建控件
  {
    const settingItemControlEl = document.createElement(item.type)
    settingItemEl.append(settingItemControlEl)

    if (item.type === 'setting-switch') {
      if (item.value) {
        settingItemControlEl.setAttribute('is-active', true)
      }
      settingItemControlEl.addEventListener('click', function (e) {
        const isActive = settingItemControlEl.hasAttribute('is-active')
        settingItemControlEl.toggleAttribute('is-active')
        setProperty(targetObject, item.keyPath, !isActive)
      })
    }

    if (item.type === 'input') {
      settingItemControlEl.type = item.inputType
      settingItemControlEl.value = item.value

      settingItemControlEl.addEventListener('change', (e) => {
        const value = item.customStoreFormat
          ? item.customStoreFormat(e.target.value)
          : e.target.value

        setProperty(targetObject, item.keyPath, value)
      })
    }
  }

  return settingItemEl
}

const createSettingEl = () => {
  const settingSectionEl = document.createElement('setting-section')
  settingSectionEl.innerHTML = `
    <setting-panel>
      <setting-list data-direction="column"></setting-list>
    </setting-panel>
  `
  return settingSectionEl
}
```

目前支持的控件比较有限，可以自行进行扩展  
主要就是用了一个 `proxy` 对象来同步配置文件，使用 `BroadcastChannel` 在两个窗口之间通信

```js
// renderer.js
const init = async (config) => {
  config ||= await LiteLoader.api.config.get(manifest.slug, default_config)
  // 随便做点什么？
}
const refresh = (config) => {
  // 执行卸载逻辑，再init一次

  init(config)
}

// 初始化
init()
// 监听更新
const bc = new BroadcastChannel('QQRedPackGetterII')
bc.addEventListener('message', (e) => {
  const config = e.data
  refresh(config)
})
```

因为涉及到配置文件更新，需要你自己书写插件的加载和卸载逻辑

## HOOK Vue

因 QQNT 是基于 Vue 写的，如果想要获取相对底层的能力则需要拿到挂在 Vue 上的各种 API 和数据  
否则的话就只能基于 DOM 元素进行一些缝缝补补，如果只是做样式美化那到也足够了。  
Vue 挂载后会在`mount()`的参数中挂载应用实例，也就是常见到的`<div id="app">`这个 DOM 元素  
在控制台打印后该 DOM 则会看到关键属性

```js
// 有 id 的 DOM 元素可以直接引用
console.dir(app)

// Vue 实例
console.log(app.__vue_app__)

// 一个用于注册能够被应用内所有组件实例访问到的全局属性的对象
console.log(app.config.globalProperties)
```
