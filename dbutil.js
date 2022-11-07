const cp = require("child_process");
cp.execSync("npm install mysql");
var mysql = require('mysql');

function createConnection() {
    var connection = mysql.createConnection({
    host: "cd-cdb-1pe5tjic.sql.tencentcdb.com",//连接本地计算机
    port: 61659,//端口
    user: "root",//数据库账号
    password: "Ctt1164101128",//密码
    database: "action"//连接的数据库名
    });
    return connection;
}
module.exports.createConnection = createConnection;
