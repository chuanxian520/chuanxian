const express = require('express');
const cookieParser = require('cookie-parser');
const https = require('https');
const app = express();

// 基础中间件
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// 微信配置（你的官方密钥，直接用）
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
  strings.push({ id: strings.length + 1, string_name: name, price: Number(price) });
  res.redirect('/admin.html');
});
app.post('/admin/del-string', (req, res) => {
  strings = strings.filter(s => s.id != req.body.id);
  res.redirect('/admin.html');
});
app.get('/api/string-list', (req, res) => res.json(strings));

// 护线管管理
app.post('/admin/set-pipe', (req, res) => {
  pipePrice = Number(req.body.price);
  res.redirect('/admin.html');
});
app.get('/api/pipe-price', (req, res) => res.json({ price: pipePrice }));

// 用户列表（后台）
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

// 微信登录（原生https，无第三方依赖）
app.get('/wx/callback', (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect('/login.html');

  const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${WX_APPID}&secret=${WX_SECRET}&code=${code}&grant_type=authorization_code`;

  https.get(tokenUrl, (tokenRes) => {
    let tokenData = '';
    tokenRes.on('data', (chunk) => tokenData += chunk);
    tokenRes.on('end', () => {
      try {
        const token = JSON.parse(tokenData);
        const { openid, access_token } = token;

        const userUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`;
        https.get(userUrl, (userRes) => {
          let userData = '';
          userRes.on('data', (chunk) => userData += chunk);
          userRes.on('end', () => {
            const wxUser = JSON.parse(userData);
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
      } catch (e) {
        res.redirect('/login.html');
      }
    });
  });
});

// 提交订单
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
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>订单支付</title>
  <body style="background:#f5f5f5;padding:20px">
  <div style="max-width:360px;margin:0 auto;background:#fff;padding:25px;border-radius:16px">
  <h3>订单支付</h3>
  <p>订单号：${order.orderNo}</p>
  <p>总价：¥${order.totalPrice}</p>
  <img src="/pay.png" style="width:240px;margin-top:10px">
  <p style="color:red;text-align:center">转账备注：${order.orderNo}</p>
  </div></body>`);
});

// 微信域名校验
app.get('/MP_verify_2u8O8M66O8GQnXR0.txt', (req, res) => res.send('2u8O8M66O8GQnXR0'));

// 启动服务（Railway自动分配PORT，必须用process.env.PORT）
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ 服务启动成功，端口：${PORT}`);
});