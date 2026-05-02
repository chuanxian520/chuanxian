const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const cookieParser = require('cookie-parser');

// 中间件
app.use(cookieParser());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 数据
let users = [];
let orders = [];
let strings = [
    { id:1, string_name:"BG65" },
    { id:2, string_name:"BG80" },
    { id:3, string_name:"NBG95" }
];
let adminPassword = "123456";

// 注册
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    const exists = users.some(u => u.username === username);
    if (exists) return res.send("用户名已存在 <a href='/register.html'>返回</a>");
    users.push({ username, password });
    res.send("注册成功！<a href='/login.html'>去登录</a>");
});

// 用户登录
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) return res.send("账号或密码错误 <a href='/login.html'>返回</a>");
    res.cookie("user", username, { path:"/" });
    res.redirect("/");
});

// 退出用户
app.get('/logout', (req, res) => {
    res.clearCookie("user", { path:"/" });
    res.redirect("/login.html");
});

// 提交订单
app.post('/submit-order', (req, res) => {
    const user = req.cookies?.user || "游客";
    const { racketType, stringName, mainTension, crossTension, phone, address, remark } = req.body;
    orders.push({
        orderNo:"ORD"+Date.now(),
        username:user,
        racketType, stringName, mainTension, crossTension, phone, address, remark,
        status:"待处理"
    });
    res.redirect("/my-orders.html"); // 提交后跳转到自己的订单页
});

// 球线列表
app.get('/api/string-list', (req, res) => res.json(strings));

// 用户订单查询接口（新增！只返回当前登录用户的订单）
app.get('/api/my-orders', (req, res) => {
    const username = req.cookies?.user;
    if (!username) return res.json([]);
    const myOrders = orders.filter(o => o.username === username);
    res.json(myOrders);
});

// 管理员接口
app.post('/admin-login', (req, res) => {
    if (req.body.pwd === adminPassword) {
        res.cookie("adminAuth","ok",{ path:"/" });
        res.redirect("/admin.html");
    } else res.send("密码错误 <a href='/admin.html'>返回</a>");
});

app.get('/logoutAdmin', (req, res) => {
    res.clearCookie("adminAuth",{ path:"/" });
    res.redirect("/admin.html");
});

app.post('/change-admin-pwd', (req, res) => {
    adminPassword = req.body.newPwd;
    res.send("修改成功 <a href='/admin.html'>返回</a>");
});

app.get('/api/all-orders', (req, res) => res.json(orders));

app.post('/update-order-status', (req, res) => {
    const o = orders.find(x => x.orderNo === req.body.orderNo);
    if (o) o.status = req.body.status;
    res.redirect("/admin.html");
});

app.post('/admin/del-order', (req, res) => {
    orders = orders.filter(x => x.orderNo !== req.body.orderNo);
    res.redirect("/admin.html");
});

app.post('/admin/add-string', (req, res) => {
    const newId = strings.length ? Math.max(...strings.map(x=>x.id)) + 1 : 1;
    strings.push({ id:newId, string_name:req.body.name });
    res.redirect("/admin.html");
});

app.post('/admin/del-string', (req, res) => {
    strings = strings.filter(x => x.id != req.body.id);
    res.redirect("/admin.html");
});

// 启动
app.listen(port, () => {
    console.log("服务已启动");
    console.log("用户下单页: http://localhost:3000");
    console.log("用户订单页: http://localhost:3000/my-orders.html");
    console.log("用户登录页: http://localhost:3000/login.html");
    console.log("用户注册页: http://localhost:3000/register.html");
    console.log("管理员后台: http://localhost:3000/admin.html");
});
