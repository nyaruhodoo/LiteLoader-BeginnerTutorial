import { createDeepProxy, NAME, createSettingEl } from './utils.js'
import { createConfigList } from './config.js'
import { createConfigItem } from './createConfigItem.js'

/**
 * 用于创建插件相关的配置界面
 * @param {HTMLElement} view
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
