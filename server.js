const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));
let users = [];
let orders = [];
let smsCodes = {};
let strings = [
  { id: 1, string_name: "BG65", price: 25 },
  { id: 2, string_name: "BG80", price: 35 },
  { id: 3, string_name: "NBG95", price: 45 }
];
let pipePrice = 15;
let adminPassword = "123456";

app.post('/admin-check', (req, res) => {
  const { pwd } = req.body;
  if (pwd === adminPassword) {
    res.cookie("admin", "ok", { maxAge: 86400000 });
    res.redirect("/admin.html");
  } else {
    res.send("密码错误！<br><a href='/admin-login.html'>返回重新登录</a>");
  }
});

app.post('/change-admin-pwd', (req, res) => {
  if (!req.cookies.admin) return res.send("未登录");
  const { newPwd } = req.body;
  if (newPwd) adminPassword = newPwd;
  res.send("密码修改成功！<a href='/admin.html'>返回后台</a>");
});

app.get('/admin-logout', (req, res) => {
  res.clearCookie("admin");
  res.redirect("/admin-login.html");
});

app.get('/admin.html', (req, res) => {
  if (req.cookies.admin === "ok") {
    return res.sendFile(__dirname + '/public/admin.html');
  }
  res.redirect('/admin-login.html');
});

app.post('/admin/add-string', (req, res) => {
  if (!req.cookies.admin) return res.send("未登录");
  const { name, price } = req.body;
  const newId = strings.length ? Math.max(...strings.map(s => s.id)) + 1 : 1;
  strings.push({ id: newId, string_name: name, price: parseInt(price) || 0 });
  res.redirect('/admin.html');
});

app.post('/admin/del-string', (req, res) => {
  if (!req.cookies.admin) return res.send("未登录");
  strings = strings.filter(s => s.id != req.body.id);
  res.redirect('/admin.html');
});

app.get('/api/string-list', (req, res) => {
  res.json(strings);
});

app.post('/admin/set-pipe', (req, res) => {
  if (!req.cookies.admin) return res.send("未登录");
  pipePrice = parseInt(req.body.price) || 0;
  res.redirect('/admin.html');
});

app.get('/api/pipe-price', (req, res) => {
  res.json({ price: pipePrice });
});

app.get('/api/user-list', (req, res) => {
  if (!req.cookies.admin) return res.json([]);
  res.json(users);
});

app.get('/api/all-orders', (req, res) => {
  if (!req.cookies.admin) return res.json([]);
  res.json(orders);
});

app.post('/update-order-status', (req, res) => {
  if (!req.cookies.admin) return res.send("未登录");
  const order = orders.find(o => o.orderNo === req.body.orderNo);
  if (order) order.status = req.body.status;
  res.redirect('/admin.html');
});

app.post('/admin/del-order', (req, res) => {
  if (!req.cookies.admin) return res.send("未登录");
  orders = orders.filter(o => o.orderNo !== req.body.orderNo);
  res.redirect('/admin.html');
});

app.post('/api/send-sms', (req, res) => {
  res.json({ code: 200, msg: "功能已关闭" });
});

// ==============================================
// ✅ 这里已修好：彻底无手机号、无验证码、纯账号密码
// ==============================================
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (users.some(u => u.username === username)) {
    return res.send("用户名已存在 <a href='/register.html'>返回</a>");
  }

  users.push({
    username: username,
    pass: password,
    phone: ""
  });

  res.send("注册成功 <a href='/login.html'>登录</a>");
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.pass === password);
  if (!user) return res.send("账号或密码错误");
  res.cookie('user', username);
  res.redirect('/my-orders.html');
});

app.post('/submit-order', (req, res) => {
  const u = req.cookies.user;
  if (!u) return res.send("请先登录");
  const stringInfo = strings.find(s => s.string_name === req.body.stringName);
  const pipe = req.body.pipe === "on";
  const stringPrice = stringInfo ? stringInfo.price : 0;
  const pipeFee = pipe ? pipePrice : 0;
  const totalPrice = stringPrice + pipeFee;
  orders.push({
    orderNo: "ORD" + Date.now(),
    username: u,
    racketType: req.body.racketType,
    stringName: req.body.stringName,
    stringPrice: stringPrice,
    pipe: pipe ? "是" : "否",
    pipePrice: pipeFee,
    totalPrice: totalPrice,
    mainTension: req.body.mainTension,
    crossTension: req.body.crossTension,
    phone: req.body.phone,
    address: req.body.address,
    remark: req.body.remark,
    status: "未支付"
  });
  res.redirect('/my-orders.html');
});

app.get('/api/my-orders', (req, res) => {
  const u = req.cookies.user;
  res.json(u ? orders.filter(o => o.username === u) : []);
});

app.get('/logout', (req, res) => {
  res.clearCookie('user');
  res.redirect('/login.html');
});

app.post('/api/pay-ok', (req, res) => {
  res.json({ code: 200, msg: "请等待管理员手动审核通过" });
});

app.get('/pay-weixin', (req, res) => {
  const orderNo = req.query.orderNo;
  if (!orderNo) return res.send("订单不存在");
  const order = orders.find(o => o.orderNo === orderNo);
  if (!order) return res.send("订单不存在");
  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>订单支付</title>
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <style>
      body{margin:0;padding:20px;background:#f5f5f5;font-family:微软雅黑;}
      .box{max-width:360px;margin:0 auto;background:#fff;border-radius:16px;padding:25px;}
      h3{text-align:center;margin:0 0 15px 0;}
      .item{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #eee;}
      .total{font-size:18px;color:red;font-weight:bold;margin:15px 0;text-align:center;}
      .qrcode{text-align:center;margin:20px 0;}
      .qrcode img{width:240px;height:240px;}
      .tip{color:red;font-size:14px;text-align:center;line-height:1.6;}
      .back{text-align:center;margin-top:20px;}
      .back a{color:#007aff;text-decoration:none;}
    </style>
  </head>
  <body>
    <div class="box">
      <h3>订单支付</h3>
      <div class="item"><span>订单号</span><span>${order.orderNo}</span></div>
      <div class="item"><span>球拍型号</span><span>${order.racketType}</span></div>
      <div class="item"><span>球线</span><span>${order.stringName}</span></div>
      <div class="item"><span>球线费用</span><span>¥${order.stringPrice}</span></div>
      <div class="item"><span>护线管</span><span>${order.pipe}</span></div>
      <div class="item"><span>护线管费用</span><span>¥${order.pipePrice}</span></div>
      <div class="total">应付总价：¥${order.totalPrice}</div>
      <div class="qrcode">
        <img src="pay.png" alt="微信收款码">
      </div>
      <div class="tip">
        请严格按照上面总价转账<br>
        转账务必备注${order.orderNo}<br>
        少付乱付不予接单
      </div>
      <div class="back">
        <a href="my-orders.html">返回我的订单</a>
      </div>
    </div>
  </body>
  </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ 服务启动成功：http://localhost:" + PORT);
});