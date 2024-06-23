const { hookIpc } = require('./main/hookIpc')
const { initGrabRedBag } = require('./main/grabRedBag')

initGrabRedBag()

exports.onBrowserWindowCreated = (window) => {
  hookIpc(window)
}
