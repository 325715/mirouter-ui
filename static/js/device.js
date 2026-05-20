var queryString = window.location.search;
queryString = queryString.substring(1);
var queryArray = queryString.split("=");
// 获取MAC地址
var mac = queryArray[1];
if (mac) {
    $('#mac').text(mac);
} else {
    mdui.snackbar({
        message: '没有MAC地址😅'
    });
}
var upspeed_data = [];
var downspeed_data = [];
var upload_traffic_data = [];
var download_traffic_data = [];
var data_num = 0;
if (localStorage.getItem("darkMode") == "true") {
    lightmode = "dark"
} else {
    lightmode = "auto"
}
var speed_chart = document.getElementById("speed-chart");
var SpeedChart = echarts.init(speed_chart, lightmode);
var traffic_chart = document.getElementById("traffic-chart");
var TrafficChart = echarts.init(traffic_chart, lightmode);

function updateStatus() {
    $.get(host + '/routerapi/' + routernum + '/api/misystem/status', function(data) {

        var match
        dev = data.dev
        for (var i = 0; i < dev.length; i++) {
            //获取当前设备对象
            var device = dev[i];
            if (device.mac == mac) {
                upspeed = convertSpeed(device.upspeed)
                maxuploadspeed = convertSpeed(device.maxuploadspeed)
                downspeed = convertSpeed(device.downspeed)
                maxdownloadspeed = convertSpeed(device.maxdownloadspeed)
                uploadtotal = convertbytes(device.upload)
                downloadtotal = convertbytes(device.download)
                onlinetime = convertSeconds(device.online)
                $('#uploadspeed').text(upspeed)
                $('#maxuploadspeed').text(maxuploadspeed)
                $('#downloadspeed').text(downspeed)
                $('#maxdownloadspeed').text(maxdownloadspeed)
                $('#uploadtotal').text(uploadtotal)
                $('#downloadtotal').text(downloadtotal)
                $('#onlinetime').text(onlinetime)
                var upspeed = convertSize(device.upspeed,speedUnit)
                var downspeed = convertSize(device.downspeed,speedUnit)
                var uploadtotal = convertSize(device.upload,trafficUnit);
                var downloadtotal = convertSize(device.download,trafficUnit);
                addData(upspeed_data, upspeed)
                addData(downspeed_data, downspeed)
                addData(upload_traffic_data, uploadtotal)
                addData(download_traffic_data, downloadtotal)
                    // 调用drawChart函数，绘制图表
                SpeedChart.showLoading();
                TrafficChart.showLoading();
                drawspeedChart();
                drawtrafficChart();
                data_num += 1
                var match = true
            }
        }
        if (match != true) {
            mdui.snackbar({
                message: '该设备（如智能插座）不支持此功能😢'
            });
        }
    }).fail(function(data) {
        mdui.snackbar({
            message: "请求失败：" + data.msg
        })
    })
}

function getDeviceInfo() {
    $.get(host + '/routerapi/' + routernum + '/api/misystem/devicelist', function(data) {

        dev = data.list
        for (var i = 0; i < dev.length; i++) {
            //获取当前设备对象
            var device = dev[i];
            if (device.mac == mac) {
                if (device.icon != "") {
                    iconurl = "/web/img/" + device.icon
                } else {
                    iconurl = "/web/img/device_list_unknow.png"
                }
                ips = moreipdisplay(device.ip)
                $("#devicename").text(device.name);
                $("#deviceicon").attr("src", iconurl);
                $("#device_oname").text(device.oname);
                $("#ipaddress").text(ips);
                $("#authority_wan").text(getbooleantype(device.authority.wan));
                $("#authority_lan").text(getbooleantype(device.authority.lan));
                $("#authority_admin").text(getbooleantype(device.authority.admin));
                $("#authority_pridisk").text(getbooleantype(device.authority.pridisk));
                $("#connecttype").text(getConnectType(device.type));
                $("#isap").text(getbooleantype(device.isap));
                $("#isonline").text(getbooleantype(device.online));

                var match = true
                if (device.mac == data.mac) {
                    $("#devicename").text($("#devicename").text() + " (页面所在地)");
                }
                console.log(device)
            }
        }
        if (match != true) {
            mdui.snackbar({
                message: '好像没有这个设备呢😢'
            });
        }


    }).fail(function(data) {
        mdui.snackbar({
            message: "请求失败：" + data.msg
        })
    })
}


function updateconnectInfo() {
    $.get(host + '/routerapi/' + routernum + '/api/xqnetwork/diagdevicelist', function(data) {

        var match
        dev = data.devicelist
        for (let i = 0; i < dev.length; i++) {
            // 获取当前设备对象
            const device = dev[i];
            if (device.mac === mac) {
                let connect_port = device.port; // 连接方式，使用getConnectType获取文字
                connect_type = getConnectType(connect_port);
                $("#connect_type").text(connect_type);
                if (connect_port === 0) {
                    connect_upspeed = "Not Supported";
                    connect_downspeed = "Not supported";
                    connect_signal = "Not supported";
                } else {
                    connect_upspeed = device.upspeed + "Mbps";
                    connect_downspeed = device.downspeed + "Mbps";
                    connect_signal = device.signal + "dBm";
                    if (device.signal_warning === 1) {
                        connect_signal += "⚠️";
                    }
                }
        
                $("#connect_upspeed").text(connect_upspeed);
                $("#connect_downspeed").text(connect_downspeed);
                $("#connect_signal").text(connect_signal);
        
                var match = true;
            }
        }
        
        if (match != true) {
            mdui.snackbar({
                message: '该设备（如智能插座）不支持此功能😢'
            });
        }
    }).fail(function(data) {
        mdui.snackbar({
            message: "请求失败：" + data.msg
        })
    })
}











function drawspeedChart() {
    // 定义图表的配置项和数据
    var option = {
        backgroundColor: '',
        tooltip: {
            trigger: "axis",
        },
        xAxis: {
            type: "category",
            data: upspeed_data.map(function(item, index) {
                var data_offset = 0;
                if (data_num > 60) {
                    data_offset = data_num - 60;
                }
                return (index + data_offset + 1) * 5 + "s"; // 返回请求次数作为横坐标
            }),
        },
        yAxis: {
            type: "value",
            name: "网络速度（"+speedUnit+"）",
        },
        legend: {
            orient: 'vertical',
            left: 'right'
        },
        series: [{
                name: "上传速度（"+speedUnit+"）",
                type: "line",
                data: upspeed_data, 
            },
            {
                name: "下载速度（"+speedUnit+"）",
                type: "line",
                data: downspeed_data, 
            },
        ],
    };
    // 设置图表的配置项和数据
    SpeedChart.hideLoading();
    SpeedChart.setOption(option);
}

function drawtrafficChart() {
    // 定义图表的配置项和数据
    var option = {
        backgroundColor: '',
        tooltip: {
            trigger: "axis",
        },
        xAxis: {
            type: "category",
            data: upload_traffic_data.map(function(item, index) {
                var data_offset = 0;
                if (data_num > 60) {
                    data_offset = data_num - 60;
                }
                return (index + data_offset + 1) * 5 + "s"; // 返回请求次数作为横坐标
            }),
        },
        legend: {
            orient: 'vertical',
            left: 'right'
        },
        yAxis: {
            type: "value",
            name: "上传/下载（"+trafficUnit+"）",
        },
        series: [{
                name: "上传总量（"+trafficUnit+"）",
                type: "line",
                data: upload_traffic_data, 
            },
            {
                name: "下载总量（"+trafficUnit+"）",
                type: "line",
                data: download_traffic_data, 
            },
        ],
    };
    // 设置图表的配置项和数据
    TrafficChart.hideLoading();
    TrafficChart.setOption(option);
}
window.addEventListener('resize', function() {
    TrafficChart.resize();
    SpeedChart.resize();
});

function get_router_name() {
    $.get(host + '/routerapi/' + routernum + '/api/xqsystem/router_name', function(data) {

        router_name = data.routerName
        $("#router_name").text(router_name)

    }).fail(function(data) {
        mdui.snackbar({
            message: "请求失败：" + data.msg
        })
    })
}
$(function() {
    // 初次加载状态
    showChartLoading();
    getDeviceInfo();
    get_router_name();
    updateStatus();
    updateconnectInfo();
    // 每5秒刷新状态
    setInterval(function() {
        updateStatus();
        updateconnectInfo();
    }, pageUpdateTime);
});

// jumptodevidehisory
function jumptodevicehisory() {
    window.location.href = "/web/devicehistory/index.html?mac=" + mac;
}

// 展示加载动画
function showChartLoading() {
    TrafficChart.showLoading();
    SpeedChart.showLoading();
}