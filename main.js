const path = require("path");
const cp = require("child_process");


cp.execSync("npm install mysql");

const mysql = require("mysql");

function indexOrEnd(str, q) {
    return str.indexOf(q) === -1 ? str.length : str.indexOf(q);
}


const event = require(process.env.GITHUB_EVENT_PATH);
const {INPUT_PATH, INPUT_TOKEN} = process.env;
const file = path.join(INPUT_PATH, "main2.yml");

// Fetch the base package.json file
// https://developer.github.com/v3/repos/contents/#get-contents
const res = cp.spawnSync("curl", [
    "--header",
    "Accept: application/vnd.github.v3.raw",
    "--header",
    `Authorization: token ${INPUT_TOKEN}`,
    //`${event.repository.url}/contents/${file}?ref=${event.pull_request.base.sha}`,
    `${event.repository.url}/contents/${file}`,
  ]);
  
if (res.status != 0) {
    console.log(`::error ::${res.stderr.toString()}`);
    process.exit(res.status);
}

const str = res.stdout.toString();

var s= str.split("\n").filter(function(e){
    var k=e.split(":");
    return k[0].includes("uses");
});

//const base = JSON.parse(res.stdout.toString());
//const head = require(path.resolve(process.cwd(), file));
//console.log(`${base.name} v${base.version} => ${head.name} v${head.version}`);
//console.log(s);

var actions = "";

for (i = 0; i < s.length; i++) {
    var temp = s[i].split(':');
    var action_version = temp[1].trim().split("@");
    var action = action_version[0];
    var version = action_version[1];
    actions = actions + " " + action;
}

console.log(actions);
//console.log(`::set-output name=name::${actions}`);


let connection =mysql.createConnection({
    host: "localhost",//连接本地计算机
    port:3306,//端口
    user:"root",//数据库账号
    password:"qq124519",//密码
    database:"SchoolTownDB"//连接的数据库名
});

//调用connect方法创造连接
connection.connect((err)=>{//回调函数,如果报错会把err填充上
    if(err){
        console.error("连接失败"+err.stack);//打印堆栈信息
        return;
    }
    console.log("连接成功");
});


//关闭数据库连接
connection.end();
