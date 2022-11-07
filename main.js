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

var s = str.split("\n").filter(function (e) {
    var k = e.split(":");
    return k[0].includes("uses");
});

getVersionsofActions(s).then((res) => {
    if (res) {
        var json_data = JSON.stringify(res);
        var actions_db = [];
        getExistAction(actions_db).then((res) => {
            if (res) {
                console.log("数据库中无该配置文件，新增：");
    
                insertAction(json_data);
            } else {
                console.log("数据库中已有该配置文件，对比如下：");
                // 新的action_list与旧的action_list对比
                for (var j = 0; j < actions_db.length; j++) {
                   // console.log(actions_db[i].name + "   use:version"+actions_db[i].use_version);
                }
                // 1) 新的是确切版本 --- 不管
                
                // 2) 新的是lastest或v2 --- 对比版本

                    
            }
        }, (res) => {
            console.log("运行错误:" + res);
        });
    } else {
        console.log("配置文件中未提取出action");
    }
}, (res) => {
    console.log("运行错误:" + res);
});


async function insertAction(json_data) {
    let sql = "INSERT INTO action(project,workflow,actions,last_modified) VALUES (?,?,?,now())";
    let params = [event.repository.id, process.env.GITHUB_WORKFLOW, json_data];
    let [error, data] = await mysqlExec(sql, params);
    if (error) {
        console.log('插入成功:' + json_data);
    } else {
        console.log('sql执行失败' + data);
    }
}

async function getVersion(owner, repo) {

    let octokit = new Octokit({
        auth: INPUT_TOKEN
    });

    let response = await octokit.request('GET /repos/{owner}/{repo}/releases', {
        owner: owner,
        repo: repo
    });


    return response.data;
}


async function getExistAction(actions_db) {
    var sql = 'SELECT actions FROM action where project = ? and workflow = ?';
    let params = [event.repository.id, process.env.GITHUB_WORKFLOW];
    let [error, data] = await mysqlExec(sql, params);
    if (error) {
        if (data == null || data[0] == null) return true;
        let actions_obj = JSON.parse(data[0].actions);
        console.log(JSON.stringify(data[0].actions));
        let i = 0;
        for (let obj of actions_obj) {
            //console.log(`name:${obj.name}`);
            actions_db[i] = new Action(obj.name, obj.need_version, obj.use_version, obj.isLatest,obj.isConcrete);
            i++;
        }
        return false;
    } else {
        console.log('sql执行失败' + data);
    }
    return true;
}


async function getVersionsofActions(s) {
    var action_list = [];
    for (i = 0; i < s.length; i++) {
        let temp = s[i].split(':');
        let action_version = temp[1].trim().split("@");
        let action = action_version[0];
        let need_version = action_version[1];
        let isLatest = need_version.includes("lastest");
        var posPattern = /^v\d+\.\d+\.\d+$/;
        let isConcrete = posPattern.test(need_version);
        let use_version = need_version;
        if (!isConcrete) {
            let a = action.split("/");
            var v = await getVersion(a[0], a[1]);
            if (isLatest) {
                use_version = v[0].tag_name;

            } else {
                let regex = new RegExp(need_version + "(\\S*)");
                for (let obj of v) {
                    let tag = obj.tag_name;
                    if (tag.match(regex)) {
                        use_version = tag;
                        console.log(action + ` matched version:${use_version}`);
                        break;
                    }
                }
            }
        } else {
            console.log(action + ` concrete version:${need_version}`);
        }

        action_list[i] = new Action(action, need_version, use_version, isLatest, isConcrete);
    }
    return action_list;
}


function Action(name,need_version,use_version,isLatest,isConcrete) {
    this.name = name;
    this.need_version = need_version;
    this.use_version = use_version;
    this.isLatest = isLatest;
    this.isConcrete = isConcrete;
}
