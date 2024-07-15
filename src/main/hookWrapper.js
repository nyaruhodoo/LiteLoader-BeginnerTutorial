let Process = require('process')

/**
 * hook 实例的原型方法
 * @param {{}} instance
 * @param {string} rootName
 */
const hookInstance = (instance, rootName) => {
  const protoType = Object.getPrototypeOf(instance)

  for (const key of Object.getOwnPropertyNames(protoType)) {
    if (typeof protoType[key] === 'function') {
      if (!instance.hasOwnProperty(key)) {
        instance[key] = function (...args) {
          const ret = protoType[key].apply(this, args)

          console.log(`=== ${rootName}.${key}被调用 ===`)
          console.log(`参数:`)
          console.log(JSON.stringify(args))
          console.log(`返回值:`)
          console.log(JSON.stringify(ret))

          if (typeof ret === 'object') {
            return hookInstance(ret)
          }

          return ret
        }
      }
    }
  }

  return instance
}

const getWrapper = () => {
  /**
   * Process.dlopen 会在加载.node文件时被调用，之后可以通过exports拿到二进制文件暴露出的JS对象
   * wrapper.node 暴露出的对象是一个构造器集合，主要分为 Service 和 Listener 2个部分
   */
  return new Promise((res, rej) => {
    Process.dlopen = new Proxy(Process.dlopen, {
      /**
       *
       * @param {()=>void} target
       * @param {*} thisArg
       * @param {[{id:number,loaded:boolean,exports:{},paths:[],children:[]},string]} argArray - [module,filename]
       * @returns
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
                    console.log(`${p} 被构造`)
                    console.log('参数如下')
                    console.log(argArray)

                    const ret = Reflect.construct(target, argArray)

                    console.log('返回值如下')
                    console.log(ret)
                    console.log('-------------------------------------------')

                    if (typeof ret === 'object') {
                      return new Proxy(ret, {})
                    }

                    return ret
                  },
                })
              }
              return Reflect.get(target, p, receiver)
            },
          })

          res(exports)
        }

        return ret
      },
    })
  })
}

module.exports = {
  async hookWrapper() {
    const res = await getWrapper()
    // console.log(res)
  },
}
