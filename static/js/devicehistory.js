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

function purgedata() {
    xdata = [];
    upspeed_data = [];
    downspeed_data = [];
    upload_traffic_data = [];
    download_traffic_data = [];
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

function updateStatus() {
    purgedata()
    $.get(host + '/systemapi/getdevicehistory?devicemac=' + mac, function(data) {

        history_data = data.history
        for (var i = 0; i < history_data.length; i++) {
            time = new Date(history_data[i].CreatedAt).toLocaleString();
            upspeed = history_data[i].UpSpeed
            downspeed = history_data[i].DownSpeed
            uptotal = history_data[i].UpTotal.toFixed(2)
            downtotal = history_data[i].DownTotal.toFixed(2)
            xdata.push(time)
            upspeed_data.push(convertSize(upspeed,speedUnit))
            downspeed_data.push(convertSize(downspeed,speedUnit))
            upload_traffic_data.push(convertSize(uptotal,trafficUnit))
            download_traffic_data.push(convertSize(downtotal,trafficUnit))
        }
        SpeedChart.showLoading();
        TrafficChart.showLoading();
        drawspeedChart();
        drawTrafficChart();
    }).fail(function(data) {
        mdui.snackbar({
            message: "请求失败：" + data.msg
        })
    })
}
function get_appconfig() {
    $.get(host + '/systemapi/getconfig', function(data) {
        maxsaved = data.history.maxsaved;
        databasepath = data.history.databasepath;
        sampletime = data.history.sampletime;
        $("#maxsaved").text(maxsaved);
        $("#databasepath").text(databasepath);
        $("#sampletime").text(sampletime);
        // 计算时间跨度
        timespan = convertSeconds(parseInt(sampletime) * parseInt(maxsaved));
        $("#timespan").text(timespan);
    }).fail(function(data) {
        mdui.snackbar({
            message: "请求失败：" + data.msg
        })
    })
}

function drawTrafficChart() {
    let {result_list: upload_traffic_data_processed, xdata: xdata_processed} = processTrafficData(xdata, upload_traffic_data, classification);
    let download_traffic_data_processed = processTrafficData(xdata, download_traffic_data, classification).result_list;
    // 定义图表的配置项和数据
    var option = {
        backgroundColor: '',
        tooltip: {
            trigger: "axis",
        },
        legend: {
            orient: 'vertical',
            left: 'right'
        },
        xAxis: {
            type: "category",
            data: xdata_processed
        },
        yAxis: {
            type: "value",
            name: "（" + trafficUnit + "）",
        },
        dataZoom: [{
            type: 'slider',
            xAxisIndex: 0,
            filterMode: 'none'
        }],
        series: [{
                name: "上传",
                type: "bar",
                data: upload_traffic_data_processed, 
            },
            {
                name: "下载",
                type: "bar",
                data: download_traffic_data_processed, 
            }
        ],
    };
    TrafficChart.hideLoading();
    TrafficChart.setOption(option);
}
function drawspeedChart() {
    // 定义图表的配置项和数据
    var option = {
        backgroundColor: '',
        tooltip: {
            trigger: "axis",
        },
        legend: {
            orient: 'vertical',
            left: 'right'
        },
        xAxis: {
            type: "category",
            data: xdata
        },
        yAxis: {
            type: "value",
            name: "（" + speedUnit + "）",
        },
        dataZoom: [{
            type: 'slider',
            xAxisIndex: 0,
            filterMode: 'none'
        }],
        series: [{
                name: "上传速度",
                type: "line",
                data: upspeed_data,
            },
            {
                name: "下载速度",
                type: "line",
                data: downspeed_data,
            },
        ],
    };
    SpeedChart.hideLoading();    
    SpeedChart.setOption(option);
}




$('#data-fit-time-select').val(localStorage.getItem("classification") || "min");
new mdui.Select('#data-fit-time-select')
$('#data-fit-time-select').on('change', function () {
    classification = $(this).val();
    localStorage.setItem('classification', classification);
    drawTrafficChart();
})




window.addEventListener('resize', function() {
    TrafficChart.resize();
    SpeedChart.resize();
});

$(function() {
    // 初次加载状态
    showChartLoading();
    get_appconfig();
    updateStatus();
    getDeviceInfo();
    // 每30秒刷新状态
    setInterval(function() {
        updateStatus();
    }, 30000);
});

// jumptodevidehisory
function jumptodeviceinfo() {
    window.location.href = "/web/device/index.html?mac=" + mac;
}

// 展示加载动画
function showChartLoading() {
    TrafficChart.showLoading();
    SpeedChart.showLoading();
}