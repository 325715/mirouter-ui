//重定向到http
// var protocol = location.protocol;
// if (protocol === "https:") {
//     location.href = "http://" + location.host + location.pathname;
// }
//获取host
let host = localStorage.getItem("host") || "";
//获取routernum
let routernum = localStorage.getItem("routernum") || "0";
// 获取默认时间分组
let classification = localStorage.getItem("classification") || "day";
// 获取默认速度单位
let speedUnit = localStorage.getItem("speed-unit") || "MiB/s";
// 获取默认速度单位
let trafficUnit = localStorage.getItem("traffic-unit") || "GiB";
// 获取默认语言
let language = localStorage.getItem("language") || "zh_CN";
//获取默认页面更新时间(ms)
let pageUpdateTime = localStorage.getItem("page-update-time") || 5000;
//跳转
if (window.location.host == 'mrui-web.hzchu.top' && !host && window.location.pathname !== '/web/settings/index.html') {
    window.location.href = '/web/settings/index.html';
}

$("[i18n]").i18n({
    defaultLang: language,
    filePath: "/web/i18n/",
    filePrefix: "i18n_",
    fileSuffix: "",
    forever: true,
    callback: function() {
    }
});









function processTrafficData(timeArray, dataArray, classification) {
    let data = {};
    for (let i = 0; i < timeArray.length; i++) {
        let date = new Date(timeArray[i]);
        let key;
        switch (classification) {
            case 'min':
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                break;
            case 'hour':
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
                break;
            case 'day':
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                break;
            case 'week':
                let firstDayOfYear = new Date(date.getFullYear(), 0, 1);
                let pastDaysOfYear = (date - firstDayOfYear) / 86400000;
                key = `${date.getFullYear()}-W${Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)}`;
                break;
            case 'month': // 添加月的分类方式
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                break;
            default:
                console.log('Invalid classification');
                return;
        }

        if (!data[key]) {
            data[key] = [];
        }
        data[key].push(Number(dataArray[i])); // 将字符串转换为数值，不然sumDiffs会有问题
    }
    let result = {};
    for (let key in data) {
        result[key] = sumDiffs(data[key]);
    }
    let xdata = Object.keys(result);
    let result_list = Object.values(result);
    return { result_list, xdata };
}

function sumDiffs(arr) {
    let sum = 0;
    while (arr.length > 0) {
        let subArr = [];
        for (let i = 0; i < arr.length; i++) {
            if (i === arr.length - 1 || arr[i] > arr[i + 1]) {
                subArr.push(arr[i]);
                if (subArr.length > 1) {
                    sum += subArr[subArr.length - 1] - subArr[0];
                }
                arr = arr.slice(i + 1);
                break;
            } else {
                subArr.push(arr[i]);
            }
        }
    }
    return sum.toFixed(2);
}

// 接受数字，输出速度（MiB/s）
function convertSpeed(bytesPerSecond) {
    bytesPerSecond = parseFloat(bytesPerSecond);
    var units = ["B/s", "KiB/s", "MiB/s", "GiB/s", "TiB/s"];
    var speed = bytesPerSecond;
    var index = 0;
    while (speed >= 1024 && index < units.length - 1) {
        speed = speed / 1024;
        index++;
    }
    //保留两位小数
    return speed.toFixed(2) + " " + units[index];
}

function convertbytes(bytes, mode) {
    bytes = parseFloat(bytes);
    var units = ["B", "KiB", "MiB", "GiB", "TiB"];
    var speed = bytes;
    var index = 0;
    while (speed >= 1024 && index < units.length - 1) {
        speed = speed / 1024;
        index++;
    }
    if (mode === 1) {
        return speed.toFixed(3);
    } else {
        return speed.toFixed(3) + " " + units[index];
    }
}

function convertSize(size, unit) {
    const units = {
        'B': 1,
        'B/s': 1,
        'KiB': 1024,
        'KiB/s': 1024,
        'MiB': 1024 * 1024,
        'MiB/s': 1024 * 1024,
        'GiB': 1024 * 1024 * 1024,
        'GiB/s': 1024 * 1024 * 1024,
        'TiB': 1024 * 1024 * 1024 * 1024,
        'TiB/s': 1024 * 1024 * 1024 * 1024
    };

    try {
        const divisor = units[unit];
        if (!divisor) {
            throw new Error('Invalid unit "' + unit + '", defaulting to GiB');
        }
        return (size / divisor).toFixed(2);
    } catch (error) {
        console.log(error.message);
        return (size / units['GiB']).toFixed(2);
    }
}


function roundToOneDecimal(num) {
    // 保留一位小数
    return num.toFixed(1);
}

function convertSeconds(seconds) {
    const SECONDS_IN_MINUTE = 60;
    const SECONDS_IN_HOUR = 60 * SECONDS_IN_MINUTE;
    const SECONDS_IN_DAY = 24 * SECONDS_IN_HOUR;

    let result = "";

    if (seconds >= SECONDS_IN_DAY) {
        let days = Math.floor(seconds / SECONDS_IN_DAY);
        result += days + "天";
        seconds -= days * SECONDS_IN_DAY;
    }

    if (seconds >= SECONDS_IN_HOUR) {
        let hours = Math.floor(seconds / SECONDS_IN_HOUR);
        result += hours + "小时";
        seconds -= hours * SECONDS_IN_HOUR;
    }

    if (seconds >= SECONDS_IN_MINUTE) {
        let minutes = Math.floor(seconds / SECONDS_IN_MINUTE);
        result += minutes + "分钟";
        seconds -= minutes * SECONDS_IN_MINUTE;
    }

    if (seconds > 0) {
        result += seconds + "秒";
    }

    return result;
}

// 转换布尔值
function getbooleantype(type) {
    switch (type) {
        case 0:
            return "No";
        case 1:
            return "Yes";
        default:
            return "Unknown";
    }
}
// 转换布尔值
function boolTostring(value) {
    if (value) {
        return "Yes";
    } else {
        return "No";
    }
}

function getConnectType(type) {
    // 0/1/2/3  Wired / 2.4G wifi / 5G wifi / guest wifi
    switch (type) {
        case 0:
            return "Wired";
        case 1:
            return "2.4G wifi";
        case 2:
            return "5G wifi";
        case 3:
            return "Guest wifi";
        default:
            return "Unknown";
    }
}

// 添加新数据到数组，并保持数组长度不超过60
function addData(dataArray, newData) {
    dataArray.push(newData);
    // 当数组长度大于60时，删除最先添加的数据
    if (dataArray.length > 60) {
        dataArray.shift();
    }
}

function moreipdisplay(ip) {
    var ips = "";
    if (ip.length == 1) {
        ips = ip[0].ip
    } else {
        for (var i = 0; i < ip.length; i++) {
            if (ip[i].active == 1) {
                ips += ip[i].ip;
                // 如果不是最后一个元素，添加逗号分隔符
                if (i < ip.length - 1) {
                    ips += ", ";
                }
            }
        }
    }
    return ips
}
function get_messages() {
    $.get(host + '/routerapi/' + routernum + '/api/misystem/messages', function(data) {
        if (data.messages.length != 0) {
            var msgMap = {
                '1': '<p>检测到最新版本为{$version}，进入路由器后台升级</a>。</p>',
                '3': '<p>5G Wi-Fi启动失败</a></p>',
                '4': '<p>检测到与上级路由器存在IP冲突，建议切换到有线中继模式或者避让IP冲突（{$ip}）</p>'
            };
            for (var i = data.messages.length - 1; i >= 0; i--) {
                mdui.snackbar({
                    message: msgMap[data.messages[i].type].tmpl(data.messages[i].data)
                })
            }
        }
    }).fail(function(data) {
        mdui.snackbar({
            message: "请求失败：" + data.msg
        })
    })
}
function get_location() {
    $.get(host + '/routerapi/' + routernum + '/api/xqsystem/get_location', function(data) {
        if (data.code != 0) {
            mdui.snackbar({
                message: "请求失败：" + data.msg
            })
        }
        return data.location
    }).fail(function(data) {
        mdui.snackbar({
            message: "请求失败：" + data.msg
        })
    })
}

function darkMode() {
    if (localStorage.getItem("darkMode") == "true") {
        localStorage.setItem("darkMode", "false");
        document.body.classList.remove("mdui-theme-layout-dark");
        document.body.classList.add("light");
        document.documentElement.setAttribute('data-theme', 'light');
    } else {
        localStorage.setItem("darkMode", "true");
        document.body.classList.remove("light");

        document.body.classList.add("mdui-theme-layout-dark");
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}
if (localStorage.getItem("darkMode") == "true") {
    document.body.classList.remove("light");
    document.body.classList.add("mdui-theme-layout-dark");
    document.documentElement.setAttribute('data-theme', 'dark');
}

function refreshToken() {
    $.get(host + '/systemapi/refresh', function (data) {
        mdui.snackbar({
            message: data.msg
        })

    }).fail(function(data) {
        mdui.snackbar({
            message: "请求失败：" + data.msg
        })
    })
}

$.ajaxSetup({
    error: function (jqXHR, textStatus, errorThrown) {
        mdui.snackbar({
            message: "Failed to send network request: " + textStatus
        });
    }
});
