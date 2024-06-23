export const createConfigList = (proxyConfig) => {
  return [
    [
      {
        title: '低于指定金额不自动回复(分)',
        type: 'input',
        inputType: 'text',
        keyPath: 'minimumAmount',
        value: proxyConfig.minimumAmount,
        customStoreFormat(value) {
          return +value
        },
      },
      {
        title: '关键字黑名单',
        description: '使用&进行分割',
        type: 'input',
        inputType: 'text',
        keyPath: 'redPackTextBlacklist',
        value: proxyConfig.redPackTextBlacklist.join('&'),
        customStoreFormat(value) {
          return value.trim().split('&')
        },
      },
      {
        title: '群号黑名单',
        description: '使用&进行分割',
        type: 'input',
        inputType: 'text',
        keyPath: 'groupBlacklist',
        value: proxyConfig.groupBlacklist.join('&'),
        customStoreFormat(value) {
          return value.trim().split('&')
        },
      },
      {
        title: 'Q号黑名单',
        description: '使用&进行分割',
        type: 'input',
        inputType: 'text',
        keyPath: 'senderBlacklist',
        value: proxyConfig.senderBlacklist.join('&'),
        customStoreFormat(value) {
          return value.trim().split('&')
        },
      },
    ],

    [
      {
        title: '最小延迟(ms)',
        type: 'input',
        inputType: 'number',
        value: proxyConfig.randomDelay.min,
        keyPath: 'randomDelay.min',
        customStoreFormat(value) {
          return +value
        },
      },

      {
        title: '最大延迟(ms)',
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
      title: '领取成功后随机回复',
      description: '使用&进行分割',
      type: 'input',
      inputType: 'text',
      keyPath: 'autoSendmsg',
      value: proxyConfig.autoSendmsg.join('&'),
      customStoreFormat(value) {
        return value.trim().split('&')
      },
    },

    {
      title: '跳过发言领取口令红包',
      description: '怕别用！用别怕！',
      type: 'setting-switch',
      value: proxyConfig.skipPwd,
      keyPath: 'skipPwd',
    },
  ]
}
