(() => {
  const mode = ['modern', 'menu'].includes(new URLSearchParams(location.search).get('mode')) ? new URLSearchParams(location.search).get('mode') : 'both';
  const values = { '检查版本': 'D1 · ' + mode, '微信版本': navigator.userAgent.match(/MicroMessenger\/[\d.]+/)?.[0] || '当前环境未识别为微信', '页面入口': location.href.split('#')[0], '官方SDK': '等待加载', '签名接口': '等待请求', '配置校验': '等待返回', '好友数据更新': '等待执行', '朋友圈数据更新': '等待执行', '菜单处理注册': '等待执行', '原生好友菜单事件': '尚未触发', '原生发送回调': '尚未触发', '接口支持': '等待检查' };
  const states = document.getElementById('states');
  function render(key, value) {
    if (key) values[key] = String(value);
    states.replaceChildren(...Object.entries(values).map(([name, text]) => {
      const row = document.createElement('div'), label = document.createElement('dt'), content = document.createElement('dd');
      label.textContent = name; content.textContent = text; row.append(label, content); return row;
    }));
    document.getElementById('report').textContent = JSON.stringify(values, null, 2);
  }
  const message = result => String(result?.errMsg ?? result?.err_msg ?? '回调未附带状态文字');
  const card = { title: '16暗影｜微信卡片检查', desc: '核对微信发送窗口里的标题和缩略图。', imgUrl: location.origin + '/share/site.png', link: location.href.split('#')[0], type: 'link' };
  document.getElementById('copy').onclick = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(values, null, 2)); document.getElementById('copy-status').textContent = '检查结果已复制'; }
    catch { document.querySelector('details').open = true; document.getElementById('copy-status').textContent = '请截图或复制下方检查结果'; }
  };
  render();
  async function run() {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js';
      script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
    });
    render('官方SDK', window.wx ? '1.6.0 已加载' : '加载后未发现wx对象');
    const response = await fetch('/api/wechat/jssdk?url=' + encodeURIComponent(card.link), { cache: 'no-store' });
    render('签名接口', 'HTTP ' + response.status);
    if (!response.ok) throw Error('签名请求失败');
    const data = await response.json();
    if (!data.enabled) throw Error('当前签名接口未启用');
    const apis = ['updateAppMessageShareData', 'updateTimelineShareData', 'onMenuShareAppMessage', 'onMenuShareTimeline'];
    let configFailed = false;
    wx.error(result => { configFailed = true; render('配置校验', message(result)); document.getElementById('summary').textContent = '微信校验返回错误，请把检查结果发给我。'; });
    wx.config({ debug: false, appId: data.appId, timestamp: data.timestamp, nonceStr: data.nonceStr, signature: data.signature, jsApiList: [...apis, 'checkJsApi'] });
    wx.ready(() => {
      if (configFailed) return;
      render('配置校验', 'wx.ready 已触发');
      wx.checkJsApi({ jsApiList: apis, complete: result => render('接口支持', JSON.stringify(result.checkResult ?? message(result))) });
      if (mode !== 'modern') {
        wx.onMenuShareAppMessage({ ...card, trigger: result => render('原生好友菜单事件', '已触发 · scene=' + String(result?.scene ?? '未提供')), complete: result => render('原生发送回调', message(result)) });
        wx.onMenuShareTimeline({ ...card, trigger: () => render('原生朋友圈菜单事件', '已触发'), complete: result => render('原生朋友圈回调', message(result)) });
        render('菜单处理注册', '好友和朋友圈均已注册');
      } else render('菜单处理注册', '本轮仅测试新版接口');
      if (mode !== 'menu') {
        wx.updateAppMessageShareData({ ...card, complete: result => render('好友数据更新', message(result)) });
        wx.updateTimelineShareData({ ...card, complete: result => render('朋友圈数据更新', message(result)) });
      } else { render('好友数据更新', '本轮仅测试菜单接口'); render('朋友圈数据更新', '本轮仅测试菜单接口'); }
      document.getElementById('summary').textContent = '可以打开微信右上角菜单检查发送窗口。';
    });
  }
  run().catch(error => { render('检查异常', error?.message || '脚本或网络请求未完成'); document.getElementById('summary').textContent = '检查遇到异常，请把此页截图发给我。'; });
})();
