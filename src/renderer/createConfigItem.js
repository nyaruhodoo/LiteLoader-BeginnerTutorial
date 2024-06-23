import { setProperty } from './utils.js'

/**
 * 根据 ConfigItem 创建 DOM
 * @param {object} item
 * @param {string} item.title - 名称
 * @param {string=} item.description - 描述
 * @param {string} item.type - 控件类型
 * @param {string=} item.inputType - input 类型
 * @param {any} item.value - 默认值
 * @param {string} item.keyPath - 从配置中读取该属性的路径
 * @param {(value:any)=>any} item.customStoreFormat - 自定义处理函数，用于对值做一些转换处理
 * @param {object} proxyConfig - 配置对象
 */
export const createConfigItem = (item, proxyConfig) => {
  // 初始化容器
  const configItemEl = document.createElement('setting-item')
  configItemEl.setAttribute('data-direction', 'row')
  configItemEl.innerHTML = '<div class="setting-item-text"></div>'

  // 创建标题
  {
    const textBoxEl = configItemEl.querySelector('.setting-item-text')
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

  return configItemEl
}
