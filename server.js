const express = require('express');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const wxConfig = require('./wx.config.js');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

let users = [];
let orders = [];
let strings = [
  { id: 1, string_name: "BG65", price: 25 },
  { id: 2, string_name: "BG80", price: 35 },
  { id: 3, string_name: "NBG95", price: 45 }
];
let pipePrice = 15;
let adminPassword = "123456";

// 管理员登录
app.post('/admin-check', (req, res) => {
  if (req.body.pwd === adminPassword) {
    res.cookie("admin", "ok", { maxAge: 86400000 });
    res.redirect("/admin.html");
  } else {
    res.send("密码错误 <a href='/admin-login.html'>返回</a>");
  }
});

app.get('/admin-logout', (req, res) => {
  res.clearCookie("admin");
  res.redirect("/admin-login.html");
});

// 球线管理
app.post('/admin/add-string', (req, res) => {
  const { name, price } = req.body;
  strings.push({ id: strings.length + 1, string_name: name, price: parseInt(price) });
  res.redirect('/admin.html');
});
app.post('/admin/del-string', (req, res) => {
  strings = strings.filter(s => s.id != req.body.id);
  res.redirect('/admin.html');
});
app.get('/api/string-list', (req, res) => res.json(strings));

// 护线管
app.post('/admin/set-pipe', (req, res) => {
  pipePrice = parseInt(req.body.price);
  res.redirect('/admin.html');
});
app.get('/api/pipe-price', (req, res) => res.json({ price: pipePrice }));

// 用户列表（后台查看微信用户）
app.get('/api/user-list', (req, res) => {
  if (!req.cookies.admin) return res.json([]);
  res.json(users);
});

// 订单管理
app.get('/api/all-orders', (req, res) => {
  if (!req.cookies.admin) return res.json([]);
  res.json(orders);
});
app.post('/update-order-status', (req, res) => {
  const o = orders.find(i => i.orderNo === req.body.orderNo);
  if (o) o.status = req.body.status;
  res.redirect('/admin.html');
});
app.post('/admin/del-order', (req, res) => {
  orders = orders.filter(o => o.orderNo !== req.body.orderNo);
  res.redirect('/admin.html');
});

// 微信登录（自动注册）
app.get('/wx/callback', async (req, res) => {
  try {
    const token = await axios.get('https://api.weixin.qq.com/sns/oauth2/access_token', {
      params: { appid: wxConfig.appId, secret: wxConfig.appSecret, code: req.query.code, grant_type: 'authorization_code' }
    });
    const { access_token, openid } = token.data;
    const user = await axios.get('https://api.weixin.qq.com/sns/userinfo', { params: { access_token, openid, lang: 'zh_CN' } });

    let u = users.find(i => i.wxOpenid === openid);
    if (!u) {
      u = { username: user.data.nickname, wxOpenid: openid, nickname: user.data.nickname, headimgurl: user.data.headimgurl, createTime: new Date().toLocaleString() };
      users.push(u);
    }
    res.cookie('user', u.username);
    res.redirect('/index.html');
  } catch (e) {
    res.redirect('/login.html');
  }
});

// 提交订单
app.post('/submit-order', (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect('/login.html');
  const str = strings.find(s => s.string_name === req.body.stringName);
  const pipe = req.body.pipe === 'on';
  orders.push({
    orderNo: "ORD" + Date.now(), username: user,
    racketType: req.body.racketType, stringName: req.body.stringName,
    stringPrice: str?.price || 0, pipe: pipe ? "是" : "否", pipePrice: pipe ? pipePrice : 0,
    totalPrice: (str?.price || 0) + (pipe ? pipePrice : 0),
    mainTension: req.body.mainTension, crossTension: req.body.crossTension,
    phone: req.body.phone, address: req.body.address, remark: req.body.remark,
    status: "未支付"
  });
  res.redirect('/my-orders.html');
});

// 我的订单
app.get('/api/my-orders', (req, res) => {
  const u = req.cookies.user;
  res.json(u ? orders.filter(o => o.username === u) : []);
});

// 退出登录
app.get('/logout', (req, res) => {
  res.clearCookie('user');
  res.redirect('/login.html');
});

// 支付页面
app.get('/pay-weixin', (req, res) => {
  const order = orders.find(o => o.orderNo === req.query.orderNo);
  if (!order) return res.send("订单不存在");
  res.send(`
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
  <style>body{background:#f5f5f5;padding:20px}.box{max-width:360px;margin:0 auto;background:#fff;padding:25px;border-radius:16px}
  .item{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #eee}
  .total{color:red;font-size:18px;text-align:center;margin:15px}</style>
  </head>
  <body><div class="box">
  <h3>订单支付</h3>
  <div class="item"><span>订单号</span><span>${order.orderNo}</span></div>
  <div class="item"><span>球拍</span><span>${order.racketType}</span></div>
  <div class="total">总价：¥${order.totalPrice}</div>
  <div style="text-align:center;margin:20px"><img src="/pay.png" style="width:240px"></div>
  <div style="color:red;text-align:center">请备注：${order.orderNo}</div>
  </div></body></html>`);
});

// 微信域名校验
app.get('/MP_verify_2u8O8M66O8GQnXR0.txt', (req, res) => res.send('2u8O8M66O8GQnXR0'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅ 启动成功，可直接部署使用"));