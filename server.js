const express = require('express');
const cookieParser = require('cookie-parser');
const https = require('https');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// 微信配置（你的官方密钥）
const WX_APPID = "wx9feec4bdaea6a15c";
const WX_SECRET = "795a1be950003da3b770e02bc03af286";

// 业务数据
let users = [];
let orders = [];
let strings = [
  { id: 1, string_name: "BG65", price: 25 },
  { id: 2, string_name: "BG80", price: 35 },
  { id: 3, string_name: "NBG95", price: 45 }
];
let pipePrice = 15;
let adminPassword = "123456";

// ------------------------------
// 管理员后台
// ------------------------------
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

// ------------------------------
// 球线 & 护线管管理
// ------------------------------
app.post('/admin/add-string', (req, res) => {
  const { name, price } = req.body;
  strings.push({ id: strings.length + 1, string_name: name, price: Number(price) });
  res.redirect('/admin.html');
});
app.post('/admin/del-string', (req, res) => {
  strings = strings.filter(s => s.id != req.body.id);
  res.redirect('/admin.html');
});
app.get('/api/string-list', (req, res) => res.json(strings));

app.post('/admin/set-pipe', (req, res) => {
  pipePrice = Number(req.body.price);
  res.redirect('/admin.html');
});
app.get('/api/pipe-price', (req, res) => res.json({ price: pipePrice }));

// ------------------------------
// 用户管理（后台查看微信用户）
// ------------------------------
app.get('/api/user-list', (req, res) => {
  if (!req.cookies.admin) return res.json([]);
  res.json(users);
});

// ------------------------------
// 订单管理
// ------------------------------
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

// ------------------------------
// 微信公众号一键登录（原生https，Railway 100%兼容）
// ------------------------------
app.get('/wx/callback', (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect('/login.html');

  const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${WX_APPID}&secret=${WX_SECRET}&code=${code}&grant_type=authorization_code`;

  https.get(tokenUrl, (tokenRes) => {
    let tokenBuf = '';
    tokenRes.on('data', d => tokenBuf += d);
    tokenRes.on('end', () => {
      const token = JSON.parse(tokenBuf);
      const { openid, access_token } = token;

      const userUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`;
      https.get(userUrl, (userRes) => {
        let userBuf = '';
        userRes.on('data', d => userBuf += d);
        userRes.on('end', () => {
          const wxUser = JSON.parse(userBuf);
          let user = users.find(u => u.wxOpenid === openid);
          if (!user) {
            user = {
              username: wxUser.nickname,
              wxOpenid: openid,
              nickname: wxUser.nickname,
              headimgurl: wxUser.headimgurl,
              createTime: new Date().toLocaleString()
            };
            users.push(user);
          }
          res.cookie('user', user.username);
          res.redirect('/index.html');
        });
      });
    });
  });
});

// ------------------------------
// 订单提交 & 我的订单
// ------------------------------
app.post('/submit-order', (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect('/login.html');
  const str = strings.find(s => s.string_name === req.body.stringName);
  const pipe = req.body.pipe === 'on';
  orders.push({
    orderNo: "ORD" + Date.now(),
    username: user,
    racketType: req.body.racketType,
    stringName: req.body.stringName,
    stringPrice: str?.price || 0,
    pipe: pipe ? "是" : "否",
    pipePrice: pipe ? pipePrice : 0,
    totalPrice: (str?.price || 0) + (pipe ? pipePrice : 0),
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

// ------------------------------
// 退出 & 支付页
// ------------------------------
app.get('/logout', (req, res) => {
  res.clearCookie('user');
  res.redirect('/login.html');
});
app.get('/pay-weixin', (req, res) => {
  const order = orders.find(o => o.orderNo === req.query.orderNo);
  if (!order) return res.send("订单不存在");
  res.send(`
  <!DOCTYPE html>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>订单支付</title>
  <body style="background:#f5f5f5;padding:20px">
  <div style="max-width:360px;margin:0 auto;background:#fff;padding:25px;border-radius:16px">
    <h3>订单支付</h3>
    <p>订单号：${order.orderNo}</p>
    <p>球拍：${order.racketType}</p>
    <p>球线：${order.stringName}</p>
    <p>总价：¥${order.totalPrice}</p>
    <div style="text-align:center;margin-top:20px"><img src="/pay.png" width="240"></div>
    <p style="color:red;text-align:center">转账备注：${order.orderNo}</p>
  </div>
  </body>
  `);
});

// 微信域名校验
app.get('/MP_verify_2u8O8M66O8GQnXR0.txt', (req, res) => {
  res.send('2u8O8M66O8GQnXR0');
});

// 启动
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ Railway 部署成功，服务已运行");
});