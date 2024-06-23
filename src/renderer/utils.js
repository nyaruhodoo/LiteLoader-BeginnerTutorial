export const NAME = 'GrabRedBag'

export const log = (...data) => {
  console.log(`[${NAME}]:`, ...data)
}

/**
 * 监听 hash 改变(一次性)
 * @param {(hash:string)=>void} callback
 */
export function watchURLHash(callback) {
  if (!location.hash.includes('#/blank')) {
    callback(location.hash)
  } else {
    navigation.addEventListener(
      'navigatesuccess',
      () => {
        callback(location.hash)
      },
      { once: true }
    )
  }
}

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
 * 生成指定范围随机数
 * @param {Number} min
 * @param {Number} max
 */
export const randomInteger = (min, max) => {
  let rand = min + Math.random() * (max + 1 - min)
  return Math.floor(rand)
}

/**
 * 向指定DOM派发事件
 * @param {String | HTMLElement} select
 * @param {Document | HTMLElement} doc
 */
export const dispatchClick = (select, doc = document, eventType = 'click') => {
  let event = new Event(eventType, { bubbles: true, cancelable: true })
  let el = typeof select === 'string' ? doc.querySelector(select) : select
  if (el !== null) {
    el.dispatchEvent(event)
  }
}

/**
 * 小小包装一下MutationObserver
 * @param {Function} callback
 */
export const createObserver = (callback) => {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (!mutation.addedNodes.length) return
      const target = mutation.addedNodes[0]
      callback(target, mutation.type)
    })
  })

  return observer
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

export const createSettingEl = () => {
  const settingSectionEl = document.createElement('setting-section')
  settingSectionEl.innerHTML = `
    <setting-panel>
      <setting-list data-direction="column"></setting-list>
    </setting-panel>
  `
  return settingSectionEl
}
