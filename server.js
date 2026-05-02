const express = require('express');
const cookieParser = require('cookie-parser');
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
const adminPassword = "admin123";

// 注册
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (users.find(u => u.username === username)) {
    return res.send("<script>alert('账号已存在');history.back()</script>");
  }
  users.push({ username, password });
  res.redirect('/login.html');
});

// 登录
app.post('/do-login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    res.cookie("user", username, { path: "/" });
    res.redirect("/index.html");
  } else {
    res.send("<script>alert('账号或密码错误');history.back()</script>");
  }
});

// 管理员
app.post('/admin-check', (req, res) => {
  if (req.body.pwd === adminPassword) {
    res.cookie("admin", "ok");
    res.redirect("/admin.html");
  } else {
    res.send("密码错误 <a href='admin-login.html'>返回</a>");
  }
});

app.get('/admin-logout', (req, res) => {
  res.clearCookie("admin");
  res.redirect("/admin-login.html");
});

// 线材管理
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

// 订单
app.get('/api/user-list', (req, res) => {
  res.json(req.cookies.admin ? users : []);
});

app.get('/api/all-orders', (req, res) => {
  res.json(req.cookies.admin ? orders : []);
});

app.post('/update-order-status', (req, res) => {
  const { orderNo, status } = req.body;
  const order = orders.find(x => x.orderNo === orderNo);
  if (order) order.status = status;
  res.redirect('/admin.html');
});

app.post('/admin/del-order', (req, res) => {
  const { orderNo } = req.body;
  orders = orders.filter(x => x.orderNo !== orderNo);
  res.redirect('/admin.html');
});

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
    phone, address, remark, status: "待支付"
  });

  res.redirect('/my-orders.html');
});

app.get('/api/my-orders', (req, res) => {
  const user = req.cookies.user;
  res.json(user ? orders.filter(o => o.username === user) : []);
});

// 退出
app.get('/logout', (req, res) => {
  res.clearCookie('user');
  res.redirect('/login.html');
});

// 启动
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("服务启动成功");
});