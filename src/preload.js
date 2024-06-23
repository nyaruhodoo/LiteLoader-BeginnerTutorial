const { contextBridge, ipcRenderer } = require('electron')

const NAME = 'GrabRedBag'

contextBridge.exposeInMainWorld(NAME, {
  refresh(config) {
    ipcRenderer.send(NAME, config)
  },
})
