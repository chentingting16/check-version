function Action(name,need_version,use_version,isLatest,isConcrete) {
    this.name = name;
    this.need_version = need_version;
    this.use_version = use_version;
    this.isLatest = isLatest;
    this.isConcrete = isConcrete;
}

const path = require("path"); 
const cp = require("child_process");
cp.execSync("npm install mysql");
cp.execSync("npm install request");
cp.execSync("npm install @octokit/core");
const { Octokit } = require("@octokit/core");
let mysqlExec = require('./util.js');

const event = require(process.env.GITHUB_EVENT_PATH);
const {INPUT_PATH, INPUT_FILE, INPUT_TOKEN} = process.env;
var file = path.join(INPUT_PATH, INPUT_FILE);

// https://developer.github.com/v3/repos/contents/#get-contents
const res = cp.spawnSync("curl", [
    "--header",
    "Accept: application/vnd.github.v3.raw",
    "--header",
    `Authorization: token ${INPUT_TOKEN}`,
    //`${event.repository.url}/contents/${file}?ref=${event.pull_request.base.sha}`,
    `${event.repository.url}/contents/${file}`,
]);


// 获取版本号
// https://blog.csdn.net/catoop/article/details/121543187
// https://blog.csdn.net/weixin_34416649/article/details/93643111?spm=1001.2101.3001.6650.4&utm_medium=distribute.pc_relevant.none-task-blog-2%7Edefault%7ECTRLIST%7ERate-4-93643111-blog-121543187.pc_relevant_3mothn_strategy_recovery&depth_1-utm_source=distribute.pc_relevant.none-task-blog-2%7Edefault%7ECTRLIST%7ERate-4-93643111-blog-121543187.pc_relevant_3mothn_strategy_recovery&utm_relevant_index=9
// VERSION=$(curl -sL https://api.github.com/repos/kube-vip/kube-vip/releases | jq -r ".[0].name")
// echo $VERSION
  
if (res.status != 0) {
    console.log(`::error ::${res.stderr.toString()}`);
    process.exit(res.status);
}

const str = res.stdout.toString();

var s= str.split("\n").filter(function(e){
    var k=e.split(":");
    return k[0].includes("uses");
});

var action_list = [];
for (i = 0; i < s.length; i++) {
    let temp = s[i].split(':');
    let action_version = temp[1].trim().split("@");
    let action = action_version[0];
    let need_version = action_version[1];
    // function Action(name,need_version,use_version,isLatest,isConcrete) {
    let isLatest = need_version.includes("lastest");
    var posPattern = /^v\d+\.\d+\.\d+$/;
    let isConcrete = posPattern.test(need_version);
    let use_version = need_version;
    if (!isConcrete) {
        let a = action.split("/");
        if (isLatest) {
            use_version = need_version;
            getVersion(a[0], a[1]).then((v)=>{
                console.log(action + ` latest version:${v[0].tag_name}`);
                use_version = v[0].tag_name;
                action_list[i] = new Action(action, need_version, use_version, isLatest, isConcrete);
            },(v)=>{ console.log("运行错误2:"+ JSON.stringify(res)); });
        } else {
            let regex = new RegExp(need_version+"(\\S*)");
            getVersion(a[0], a[1]).then((v)=>{
                for (let obj of v) {
                    let tag = obj.tag_name;
                    if (tag.match(regex)) {
                        use_version = tag;
                        console.log(action + ` matched version:${use_version}`);
                        break;
                    }
                }
                action_list[i] = new Action(action, need_version, use_version, isLatest, isConcrete);
            },(v)=>{ console.log("运行错误3:"+ JSON.stringify(res)); });
        }
    } else {
        console.log(action + ` concrete version:${need_version}`);
        action_list[i] = new Action(action, need_version, use_version, isLatest, isConcrete);
    }
    
    //console.log(JSON.stringify(action_list[i]));
}


var json_data = '';
function sleep (time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
 
sleep(5000).then(() => {
    json_data = json_data+JSON.stringify(action_list);
    var actions_db = [];
    let mysqlExec = require('./util.js');
    getExistAction().then((res)=>{
        if (res) {
            console.log("数据库中无该配置文件，新增");
        //查询当前 模糊版本的确切版本
            insertAction(json_data);
        } else {
            console.log("有数据了");
        // 新的action_list与旧的action_list对比
        // 1) 新的是确切版本 --- 不管
        
        // 2) 新的是lastest或v2 --- 对比版本
        
        
        }
    },(res)=>{ console.log("运行错误1:"+res);});
});

async function insertAction(json_data) {
    let sql = "INSERT INTO action(project,workflow,actions,last_modified) VALUES (?,?,?,now())";
    let params=[event.repository.id, process.env.GITHUB_WORKFLOW, json_data];
    let [error, data] = await mysqlExec(sql, params);
    if (error) {
        console.log('插入成功'+data);
    } else {
        console.log('sql执行失败'+data);
    }
}

async function getVersion(owner, repo) {
    //console.log(owner+" "+repo);
    let octokit = new Octokit({
        auth: INPUT_TOKEN
    });

    let response = await octokit.request('GET /repos/{owner}/{repo}/releases', {
        owner: owner,
        repo: repo
    });
    
    //console.log('response.data hhhh:', response.data); 
    return response.data;
}


async function getExistAction() {
    var  sql = 'SELECT actions FROM action where project = ? and workflow = ?';
    let params =[event.repository.id, process.env.GITHUB_WORKFLOW];
    let [error, data] = await mysqlExec(sql, params);
    if (error) {
        if (data == null || data[0] == null) return true;
        let actions_obj = JSON.parse(data[0].actions);
        //[{\"name\":\"actions/checkout\",\"version\":\"v2\"},{\"name\":\"actions/cache\",\"version\":\"v2\"},{\"name\":\"actions/stale\",\"version\":\"v6.0.1\"}]
        let i = 0;
        for (let obj of actions_obj) {
            console.log(`name:${obj.name}`);
            actions_db[i] = new Action(obj.name,obj.version);
            i++;
        }
        return false;
    } else {
        console.log('sql执行失败'+data);
    }
    return true;
}
