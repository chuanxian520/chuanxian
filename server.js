const express = require('express');
const cookieParser = require('cookie-parser');
const https = require('https');
const app = express();

// 中间件
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// 全局数据
let users = [];
let orders = [];
let strings = [
  { id: 1, string_name: "BG65", price: 25 },
  { id: 2, string_name: "BG80", price: 35 },
  { id: 3, string_name: "NBG95", price: 45 }
];
let pipePrice = 15;
const adminPassword = "admin123";

// 管理员登录校验
app.post('/admin-check', (req, res) => {
  const pwd = req.body.pwd;
  if (pwd === adminPassword) {
    res.cookie("admin", "ok");
    res.redirect("/admin.html");
  } else {
    res.send("密码错误，<a href='admin-login.html'>返回</a>");
  }
});

app.get('/admin-logout', (req, res) => {
  res.clearCookie("admin");
  res.redirect("/admin-login.html");
});

// 线材管理接口
app.post('/admin/add-string', (req, res) => {
  const { string_name, price } = req.body;
  strings.push({ id: Date.now(), string_name, price: Number(price) });
  res.redirect('/admin.html');
});

app.post('/admin/del-string', (req, res) => {
  const { id } = req.body;
  strings = strings.filter(s => s.id != id);
  res.redirect('/admin.html');
});

app.get('/api/string-list', (req, res) => {
  res.json(strings);
});

app.post('/admin/set-pipe', (req, res) => {
  pipePrice = Number(req.body.pipePrice);
  res.redirect('/admin.html');
});

app.get('/api/pipe-price', (req, res) => {
  res.json({ price: pipePrice });
});

// 用户&订单接口
app.get('/api/user-list', (req, res) => {
  res.json(req.cookies.admin ? users : []);
});

app.get('/api/all-orders', (req, res) => {
  res.json(req.cookies.admin ? orders : []);
});

app.post('/update-order-status', (req, res) => {
  const { orderNo, status } = req.body;
  const o = orders.find(x => x.orderNo === orderNo);
  if (o) o.status = status;
  res.redirect('/admin.html');
});

app.post('/admin/del-order', (req, res) => {
  const { orderNo } = req.body;
  orders = orders.filter(x => x.orderNo !== orderNo);
  res.redirect('/admin.html');
});

// ========== 微信登录（已修复，直接写死，无变量报错） ==========
app.get('/wx/callback', (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect('/login.html');

  const tokenUrl1 = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=wx9feec4bdaea6a15c&secret=795a1be950003da3b770e02bc03af286&code=${code}&grant_type=authorization_code`;

  https.get(tokenUrl1, (tokenRes) => {
    let tokenData = '';
    tokenRes.on('data', chunk => tokenData += chunk);
    tokenRes.on('end', () => {
      try {
        const token = JSON.parse(tokenData);
        const { openid, access_token } = token;

        const userUrl1 = `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`;
        https.get(userUrl1, (userRes) => {
          let userData = '';
          userRes.on('data', chunk => userData += chunk);
          userRes.on('end', () => {
            const wx = JSON.parse(userData);
            let user = users.find(x => x.wxOpenid === openid);
            if (!user) {
              user = {
                username: wx.nickname,
                wxOpenid: openid,
                nickname: wx.nickname,
                headimgurl: wx.headimgurl
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

  const { racketType, stringName, pipe, phone, address, remark } = req.body;
  const str = strings.find(s => s.string_name === stringName);
  const stringPrice = str ? str.price : 0;
  const pipeFee = pipe === 'on' ? pipePrice : 0;
  const totalPrice = stringPrice + pipeFee;
  const orderNo = "ORD" + Date.now();

  orders.push({
    orderNo, username: user, racketType, stringName,
    pipe: pipe === 'on' ? "是" : "否",
    stringPrice, pipeFee, totalPrice,
    phone, address, remark, status: "待处理"
  });
  res.redirect('/my-orders.html');
});

app.get('/api/my-orders', (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.json([]);
  res.json(orders.filter(o => o.username === user));
});

app.get('/logout', (req, res) => {
  res.clearCookie('user');
  res.redirect('/login.html');
});

// 微信域名校验文件路由
app.get('/MP_verify_2U8OM66OBGQnXR0.txt', (req, res) => {
  res.send('2U8OM66OBGQnXR0');
});

// 启动服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务已启动，端口：${PORT}`);
});